

function includes(value, filter) {
  if (!filter) return true;
  const normalizedValue = normalize(value);
  const compactFilter = compactSearchText(filter);
  return normalizedValue.includes(filter) ||
    Boolean(compactFilter && compactSearchText(normalizedValue).includes(compactFilter));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('el-GR')
    .replace(/ς/g, 'σ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(value) {
  return value.replace(/[^\p{L}\p{N}]+/gu, '');
}

function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', {
    maximumFractionDigits: 3,
    useGrouping: false
  });
}

function formatSignedQuantity(value) {
  const number = Number(value);
  const formatted = formatQuantity(Math.abs(number));

  if (number > 0) {
    return `+${formatted}`;
  }

  if (number < 0) {
    return `-${formatted}`;
  }

  return '0';
}

function formatDifference(value) {
  return formatQuantity(Math.abs(Number(value)));
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('el-GR');
}

function formatDateWithDashes(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
}

function pathToFileUrl(value) {
  if (!value) return '';
  const normalized = String(value).replace(/\\/g, '/');
  return `file:///${normalized.replace(/^\/+/, '')}`;
}

export { includes, normalize, compactSearchText, formatQuantity, formatSignedQuantity, formatDifference, formatDate, formatDateWithDashes, pathToFileUrl };
