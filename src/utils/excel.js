'use strict';

const ExcelJS = require('exceljs');

const TEMPLATE_HEADER_FILL_COLOR = 'FF0F766E';

function readCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.result !== undefined) return value.result;
    if (value.text !== undefined) return value.text;
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  }
  return value;
}

function worksheetToMatrix(worksheet, onRow) {
  const matrix = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    matrix[rowNumber - 1] = row.values.slice(1).map(readCellValue);
    if (onRow) onRow(rowNumber, worksheet.rowCount);
  });
  return matrix;
}

async function readFirstWorksheet(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook.worksheets[0] || null;
}

function applyTemplateHeaderStyle(sheet, { height = 32, wrapText = true } = {}) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEMPLATE_HEADER_FILL_COLOR } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', ...(wrapText ? { wrapText } : {}) };
  headerRow.height = height;
}

function createTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'diaxeirisi Ylikoy';
  return workbook;
}

module.exports = {
  applyTemplateHeaderStyle,
  createTemplateWorkbook,
  readCellValue,
  readFirstWorksheet,
  worksheetToMatrix
};
