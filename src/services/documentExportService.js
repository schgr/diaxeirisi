const fs = require('fs');
const ExcelJS = require('exceljs');

async function writeExcelExport(filePath, payload = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Διαχείριση Υλικού';
  workbook.created = new Date();
  const orientation = normalizeOrientation(payload.orientation);
  const tables = Array.isArray(payload.tables) ? payload.tables : [];
  let sources = tables.length
    ? tables
    : [{ name: payload.title || 'Κατάσταση', rows: (payload.textLines || []).map((line) => [line]) }];
  if (payload.singleWorksheet && sources.length > 1) {
    const rows = [];
    const pageBreakRows = [];
    sources.forEach((table, index) => {
      rows.push(...(Array.isArray(table.rows) ? table.rows : []));
      if (index < sources.length - 1 && rows.length) pageBreakRows.push(rows.length);
    });
    sources = [{
      name: payload.title || 'Κατάσταση',
      rows,
      pageBreakRows
    }];
  }

  sources.forEach((table, index) => {
    const worksheet = workbook.addWorksheet(uniqueWorksheetName(
      workbook,
      table.name || `${payload.title || 'Κατάσταση'} ${index + 1}`
    ));
    worksheet.pageSetup = {
      orientation,
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
    const rows = Array.isArray(table.rows) ? table.rows : [];
    rows.forEach((row) => worksheet.addRow((Array.isArray(row) ? row : [row]).map(cleanCell)));
    (table.pageBreakRows || []).forEach((rowNumber) => {
      worksheet.getRow(rowNumber).addPageBreak();
    });
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
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { ...cell.font, name: 'Arial', size: 12 };
      });
    });
  });

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

function writeWordExport(filePath, payload = {}) {
  const title = escapeHtml(payload.title || 'Κατάσταση');
  const orientation = normalizeOrientation(payload.orientation);
  const pageSize = orientation === 'landscape'
    ? '841.9pt 595.3pt'
    : '595.3pt 841.9pt';
  const rawContent = String(payload.html || '').trim() ||
    `<p>${(payload.textLines || []).map((line) => escapeHtml(line)).join('<br>')}</p>`;
  const content = forceWordTypography(deduplicateTitleHeadings(rawContent, payload.title));
  const contentText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const titleHeading = contentText.includes(String(payload.title || '').trim())
    ? ''
    : `<h1>${title}</h1>`;
  const documentHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page WordSection1 {
      size: ${pageSize};
      margin: 34pt;
      mso-page-orientation: ${orientation};
    }
    div.WordSection1 { page: WordSection1; }
    body, body * { font-family: Arial, sans-serif !important; color: #000; font-size: 12pt; }
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
<body><div class="WordSection1">${titleHeading}${content}</div></body>
</html>`;
  fs.writeFileSync(filePath, `\uFEFF${documentHtml}`, 'utf8');
  return filePath;
}

function deduplicateTitleHeadings(content, title) {
  const normalizedTitle = normalizePlainText(title);
  if (!normalizedTitle) return content;
  let titleSeen = false;
  return content.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (heading, _level, _attributes, body) => {
    if (normalizePlainText(body.replace(/<[^>]+>/g, ' ')) !== normalizedTitle) return heading;
    if (titleSeen) return '';
    titleSeen = true;
    return heading;
  });
}

function forceWordTypography(content) {
  return content.replace(/<([a-z][\w:-]*)([^>]*)>/gi, (tag, name, attributes) => {
    if (/^(?:html|head|meta|title|style|link|img|br|hr)$/i.test(name)) return tag;
    const typography = 'font-family:Arial,sans-serif !important;font-size:12pt !important;';
    if (/\sstyle\s*=/i.test(attributes)) {
      return `<${name}${attributes.replace(
        /(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/i,
        (_style, prefix, quote, value) => {
          const withoutTypography = value
            .replace(/(?:^|;)\s*font-family\s*:[^;]*/gi, '')
            .replace(/(?:^|;)\s*font-size\s*:[^;]*/gi, '');
          return `${prefix}${quote}${withoutTypography};${typography}${quote}`;
        }
      )}>`;
    }
    return `<${name}${attributes} style="${typography}">`;
  });
}

function normalizePlainText(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeOrientation(value) {
  return String(value || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
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
