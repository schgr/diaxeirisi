export function requireNonEmpty(value, fieldName = 'Πεδίο') {
  const text = String(value ?? '').trim();
  if (!text) {
    return {
      valid: false,
      field: fieldName,
      message: `Το πεδίο "${fieldName}" είναι υποχρεωτικό.`
    };
  }
  return { valid: true, value: text };
}

export function requireAtLeastOneRow(rows, fieldName = 'materials') {
  const hasRow = Array.isArray(rows) && rows.some((row) =>
    row && Object.values(row).some((value) => String(value ?? '').trim())
  );
  if (!hasRow) {
    return {
      valid: false,
      field: fieldName,
      message: 'Προσθέστε τουλάχιστον μία γραμμή υλικού.'
    };
  }
  return { valid: true, value: rows };
}

export function requireDateOrder(startDate, endDate, fieldName = 'dateRange') {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return {
      valid: false,
      field: fieldName,
      message: 'Συμπληρώστε έγκυρες ημερομηνίες.'
    };
  }
  if (start.getTime() > end.getTime()) {
    return {
      valid: false,
      field: fieldName,
      message: 'Η αρχική ημερομηνία πρέπει να προηγείται ή να είναι ίδια με την τελική.'
    };
  }
  return { valid: true, value: { startDate, endDate } };
}

function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
