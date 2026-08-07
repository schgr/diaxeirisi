const QUANTITY_FORMAT = { maximumFractionDigits: 3, useGrouping: false };

export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', QUANTITY_FORMAT);
}

export function formatSignedQuantity(value) {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${formatQuantity(number)}`;
}

export function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}
