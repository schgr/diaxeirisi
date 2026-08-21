
function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatAddyDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('el-GR', { maximumFractionDigits: 3, useGrouping: false });
}

function formatSignedNumber(value) {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function compareShareNumbers(a, b) {
  const left = Number(a.shareNumber);
  const right = Number(b.shareNumber);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a.shareNumber).localeCompare(String(b.shareNumber), 'el');
}

function getDefaultRegistryCount(shares) {
  const maxShareNumber = shares.reduce((max, share) => {
    const number = Number(share.shareNumber);
    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
  return Math.max(maxShareNumber, shares.length, 1);
}

function printLandscapeDocument() {
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 landscape; margin: 0; }';
  document.head.appendChild(style);
  window.print();
  window.setTimeout(() => style.remove(), 500);
}

export { compareShareNumbers, formatAddyDate, formatDate, formatNumber, getDefaultRegistryCount };
