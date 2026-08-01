const CODE128_PATTERNS = Object.freeze([
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112'
]);

function code128BValues(value) {
  const text = String(value || '');
  if (!text || !/^[\x20-\x7e]+$/.test(text)) return [];
  const values = [104, ...Array.from(text, (character) => character.charCodeAt(0) - 32)];
  const checksum = values.reduce(
    (total, code, index) => total + (index === 0 ? code : code * index),
    0
  ) % 103;
  return [...values, checksum, 106];
}

export function buildRequestBarcodeValue(item) {
  if (!item) return '';
  const identifier = String(item.nominalNumber || item.partNumber || '').trim();
  if (!identifier) return '';
  return `${identifier}&#9;${item.quantity}`;
}

export function renderCode128Svg(value, options = {}) {
  const values = code128BValues(value);
  if (!values.length) return '';
  const moduleWidth = Math.max(1, Number(options.moduleWidth) || 1);
  const height = Math.max(12, Number(options.height) || 30);
  const quietZone = Math.max(4, Number(options.quietZone) || 8);
  let x = quietZone;
  const bars = [];
  for (const code of values) {
    const pattern = CODE128_PATTERNS[code];
    for (let index = 0; index < pattern.length; index += 1) {
      const width = Number(pattern[index]) * moduleWidth;
      if (index % 2 === 0) {
        bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`);
      }
      x += width;
    }
  }
  const totalWidth = x + quietZone;
  return `<svg class="request-line-barcode" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Barcode" viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="none"><g fill="#000">${bars.join('')}</g></svg>`;
}

export function renderRequestItemBarcode(item) {
  return renderCode128Svg(buildRequestBarcodeValue(item), {
    moduleWidth: 1,
    height: 30,
    quietZone: 8
  });
}
