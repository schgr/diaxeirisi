'use strict';

const { parentPort } = require('worker_threads');
const fs = require('fs');

let items = [];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('el-GR')
    .replace(/[^A-ZΑ-Ω0-9]+/g, ' ')
    .trim();
}

function compactPart(part) {
  const catalogue = part && part.assembly && part.assembly.catalogue;
  const kyrio = catalogue && catalogue.kyrio;
  return {
    nominalNumber: String(part && part.nsn || ''),
    partNumber: String(part && part.pn || ''),
    description: String(part && part.name || ''),
    catalogue: String(catalogue && catalogue.name || ''),
    equipment: String(kyrio && kyrio.name || '')
  };
}

async function load(searchFile) {
  items = [];
  let started = false;
  let objectText = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let prefix = '';

  for await (const chunk of fs.createReadStream(searchFile, { encoding: 'utf8' })) {
    let index = 0;
    if (!started) {
      prefix = (prefix + chunk);
      const marker = prefix.indexOf('"allParts":[');
      if (marker < 0) {
        prefix = prefix.slice(-32);
        continue;
      }
      started = true;
      index = marker + '"allParts":['.length;
    }
    const source = prefix && started ? prefix : chunk;
    prefix = '';
    for (; index < source.length; index += 1) {
      const character = source[index];
      if (depth === 0) {
        if (character === ']') break;
        if (character !== '{') continue;
        objectText = '{';
        depth = 1;
        inString = false;
        escaped = false;
        continue;
      }
      objectText += character;
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      if (depth !== 0) continue;
      const item = compactPart(JSON.parse(objectText));
      items.push({
        ...item,
        searchText: normalize([
          item.nominalNumber,
          item.partNumber,
          item.description,
          item.catalogue,
          item.equipment
        ].join(' '))
      });
      objectText = '';
    }
  }
  if (!started || depth !== 0 || !items.length) {
    throw Object.assign(new Error('Μη έγκυρη μορφή δεδομένων Καταλόγου ΚΕΥ.'), {
      code: 'KEY_CATALOGUE_INVALID'
    });
  }
  return { itemCount: items.length };
}

function search(query, limit) {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const item of items) {
    if (!terms.every((term) => item.searchText.includes(term))) continue;
    const exact = item.nominalNumber === query || item.partNumber.toLocaleUpperCase('el-GR') === query.toLocaleUpperCase('el-GR');
    results.push({ item, exact });
    if (results.length >= limit * 4) break;
  }
  return results
    .sort((left, right) => Number(right.exact) - Number(left.exact)
      || left.item.description.localeCompare(right.item.description, 'el'))
    .slice(0, limit)
    .map(({ item }) => {
      const { searchText, ...publicItem } = item;
      return publicItem;
    });
}

parentPort.on('message', async (message) => {
  try {
    const result = message.type === 'load'
      ? await load(message.searchFile)
      : search(String(message.query || ''), Number(message.limit) || 50);
    parentPort.postMessage({ id: message.id, result });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: {
        message: error && error.message ? error.message : String(error),
        code: error && error.code ? error.code : 'KEY_CATALOGUE_ERROR'
      }
    });
  }
});
