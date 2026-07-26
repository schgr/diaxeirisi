const fs = require('fs');
const ExcelJS = require('exceljs');

async function writeExcelExport(filePath, payload = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Διαχείριση Υλικού';
  workbook.created = new Date();
  const tables = Array.isArray(payload.tables) ? payload.tables : [];
  const sources = tables.length
    ? tables
    : [{ name: payload.title || 'Κατάσταση', rows: (payload.textLines || []).map((line) => [line]) }];

  sources.forEach((table, index) => {
    const worksheet = workbook.addWorksheet(uniqueWorksheetName(
      workbook,
      table.name || `${payload.title || 'Κατάσταση'} ${index + 1}`
    ));
    const rows = Array.isArray(table.rows) ? table.rows : [];
    rows.forEach((row) => worksheet.addRow((Array.isArray(row) ? row : [row]).map(cleanCell)));
    if (worksheet.rowCount) {
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF173B56' }
      };
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
    worksheet.columns.forEach((column) => {
      let width = 10;
      column.eachCell({ includeEmpty: true }, (cell) => {
        width = Math.max(width, String(cell.value ?? '').length + 2);
      });
      column.width = Math.min(width, 55);
      column.alignment = { vertical: 'top', wrapText: true };
    });
    worksheet.eachRow((row) => {
      row.alignment = { vertical: 'top', wrapText: true };
    });
  });

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

function writeWordExport(filePath, payload = {}) {
  const title = escapeHtml(payload.title || 'Κατάσταση');
  const content = String(payload.html || '').trim() ||
    `<p>${(payload.textLines || []).map((line) => escapeHtml(line)).join('<br>')}</p>`;
  const documentHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #000; font-size: 10pt; }
    h1, h2, h3 { text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 8mm; }
    th, td { border: 1px solid #555; padding: 4px; vertical-align: top; }
    th { background: #dce6f1; font-weight: bold; }
    img, button, .no-print { display: none !important; }
    input, select, textarea { border: 0; }
    article { page-break-after: always; }
    article:last-child { page-break-after: auto; }
  </style>
</head>
<body><h1>${title}</h1>${content}</body>
</html>`;
  fs.writeFileSync(filePath, `\uFEFF${documentHtml}`, 'utf8');
  return filePath;
}

function sanitizeExportFilename(value) {
  const name = String(value || 'Κατάσταση')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/g, '')
    .trim();
  return name || 'Κατάσταση';
}

function uniqueWorksheetName(workbook, value) {
  const base = sanitizeExportFilename(value).slice(0, 31) || 'Κατάσταση';
  let candidate = base;
  let suffix = 2;
  while (workbook.getWorksheet(candidate)) {
    const tail = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  return candidate;
}

function cleanCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  sanitizeExportFilename,
  writeExcelExport,
  writeWordExport
};
