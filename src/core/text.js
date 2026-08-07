function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}

function normalizeHeaderText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('el-GR');
}

module.exports = {
  normalizeHeaderText,
  normalizeText
};
