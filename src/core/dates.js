const MILLISECONDS_PER_DAY = 86400000;

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function differenceInDays(toDate, fromDate) {
  const to = new Date(`${toDate}T00:00:00`);
  const from = new Date(`${fromDate}T00:00:00`);
  return Math.ceil((to - from) / MILLISECONDS_PER_DAY);
}

function formatGreekDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

module.exports = {
  addDays,
  differenceInDays,
  formatGreekDate,
  toIsoDate,
  todayIsoDate
};
