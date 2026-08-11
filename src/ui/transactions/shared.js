export function collectRows(root, selector) {
  return Array.from(root.querySelectorAll(selector)).filter((row) =>
    Array.from(row.querySelectorAll('[data-row-field]')).some((input) => String(input.value || '').trim())
  );
}

export function readSupportField(root, group, name) {
  return root.querySelector(`[data-${group}-field="${name}"]`)?.value.trim() || '';
}

export function readRowField(row, name) {
  return row.querySelector(`[data-row-field="${name}"]`)?.value.trim() || '';
}

export function readOptionalNumber(value) {
  const text = String(value || '').trim();
  return text ? Number(text.replace(',', '.')) : null;
}

export function setReadonlyRowField(row, name, value) {
  const input = row.querySelector(`[data-row-field="${name}"]`);
  if (!input) return;
  input.value = value;
  input.readOnly = true;
}

export function officialDateParts(value) {
  const [year = '', month = '', day = ''] = String(value || '').slice(0, 10).split('-');
  const monthNames = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  return { day, month, monthName: monthNames[Number(month)] || month, year };
}

export function greekMonthNumber(value) {
  const normalized = normalize(value);
  const names = ['ιανουαριου', 'φεβρουαριου', 'μαρτιου', 'απριλιου', 'μαιου', 'ιουνιου', 'ιουλιου', 'αυγουστου', 'σεπτεμβριου', 'οκτωβριου', 'νοεμβριου', 'δεκεμβριου'];
  const index = names.indexOf(normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (index >= 0) return String(index + 1).padStart(2, '0');
  const number = Number(value);
  return number >= 1 && number <= 12 ? String(number).padStart(2, '0') : '';
}

export function findShareByNumber(shares, value) {
  const normalized = normalize(value);
  return shares.find((share) => normalize(share.shareNumber) === normalized);
}

export function findShareByNominal(shares, value) {
  return findSharesByNominal(shares, value)[0];
}

export function findSharesByNominal(shares, value) {
  const normalized = normalize(value);
  if (!normalized) return [];
  return shares.filter((share) => normalize(share.nominalNumber) === normalized);
}

export function compareShareNumbers(left, right) {
  const leftValue = String(left.shareNumber || '').trim();
  const rightValue = String(right.shareNumber || '').trim();
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const leftNumeric = leftValue !== '' && Number.isFinite(leftNumber);
  const rightNumeric = rightValue !== '' && Number.isFinite(rightNumber);
  if (leftNumeric && rightNumeric && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return leftValue.localeCompare(rightValue, 'el', { numeric: true });
}

export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}

export function normalizeIssueReason(value) {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[().,;:]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameIssueReason(left, right) {
  return normalizeIssueReason(left) === normalizeIssueReason(right);
}

export function isCommerceUnit(value) {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '') === 'εμποριο';
}

export function displaySupportStatus(value) {
  return value === 'Πλήρης για ΕΥΣ' ? 'Πλήρης' : value;
}

export function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', {
    maximumFractionDigits: 3,
    useGrouping: false
  });
}
