const path = require('path');
const { AppError } = require('../core/errorHandler');
const { formatGreekDate } = require('../core/dates');
const { normalizeHeaderText: normalizeHeader } = require('../core/text');
const { createInitialInventoryRepository } = require('../db/initialInventoryRepository');
const {
  applyTemplateHeaderStyle,
  createTemplateWorkbook,
  readFirstWorksheet,
  worksheetToMatrix
} = require('../utils/excel');

const TEMPLATE_HEADERS = [
  'Α/Α',
  'Αριθμός Μερίδας',
  'Αριθμός Ονομαστικού',
  'Περιγραφή',
  'Μονάδα Μέτρησης',
  'Ποσότητα',
  'Αριθμός Κυρίου Υλικού',
  'Κατηγορία Υλικού'
];

function createInitialInventoryService(db) {
  const repository = createInitialInventoryRepository(db);

  return {
    async writeTemplate(filePath) {
      const workbook = createTemplateWorkbook();
      const sheet = workbook.addWorksheet('Τελευταία Ετήσια Απογραφή', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      sheet.addRow(TEMPLATE_HEADERS);
      sheet.columns = [
        { width: 8 }, { width: 18 }, { width: 24 }, { width: 42 },
        { width: 20 }, { width: 14 }, { width: 24 }, { width: 24 }
      ];
      sheet.autoFilter = 'A1:H1';
      applyTemplateHeaderStyle(sheet);
      await workbook.xlsx.writeFile(filePath);
      return { filePath, message: 'Το πρότυπο Excel δημιουργήθηκε.' };
    },

    async importWorkbook(filePath, inventoryDate) {
      const worksheet = await readFirstWorksheet(filePath);
      if (!worksheet) throw new AppError('Το αρχείο Excel δεν περιέχει φύλλο εργασίας.', 'VALIDATION_ERROR');
      return this.importMatrix(worksheetToMatrix(worksheet), filePath, inventoryDate);
    },

    importMatrix(matrix, filePath, inventoryDate) {
      const date = String(inventoryDate || '').trim();
      if (!isValidInventoryDate(date)) {
        throw new AppError('Συμπλήρωσε την ημερομηνία της τελευταίας ετήσιας απογραφής.', 'VALIDATION_ERROR');
      }
      const latestImportDate = repository.getLatestImportDate();
      if (latestImportDate && date < latestImportDate) {
        throw new AppError(
          `Υπάρχει ήδη νεότερη ετήσια απογραφή με ημερομηνία ${formatGreekDate(latestImportDate)}.`,
          'VALIDATION_ERROR'
        );
      }

      const rows = parseRows(matrix);
      const sourceFile = path.basename(filePath);
      let sessionId;
      let serialNumber;

      repository.transaction(() => {
        serialNumber = repository.getNextInventorySerial(Number(date.slice(0, 4)));
        sessionId = repository.createInventorySession(date, serialNumber, sourceFile);
        rows.forEach((item) => {
          repository.ensureReferenceValues(item);
          const existing = repository.findShareByNumber(item.shareNumber);
          const shareId = existing ? existing.id : repository.createShare(item);
          if (existing) repository.updateShare(shareId, item);
          repository.deletePreviousOpeningTransactions(shareId);
          repository.createOpeningTransaction(shareId, date, item.quantity);
          repository.createInventoryItem(sessionId, shareId, item);
        });
        repository.createImportRecord(sessionId, date, sourceFile, rows.length);
      });

      return {
        sessionId,
        serialNumber,
        importedRows: rows.length,
        message: `Εισήχθησαν ${rows.length} μερίδες από την τελευταία ετήσια απογραφή.`
      };
    }
  };
}

function isValidInventoryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && value <= new Date().toISOString().slice(0, 10);
}

function parseRows(matrix) {
  if (!matrix.length) throw new AppError('Το αρχείο Excel είναι κενό.', 'VALIDATION_ERROR');
  const headers = matrix[0].map(normalizeHeader);
  const required = TEMPLATE_HEADERS.slice(0, 6).map(normalizeHeader);
  required.forEach((header) => {
    if (!headers.includes(header)) {
      throw new AppError(`Λείπει η υποχρεωτική στήλη "${TEMPLATE_HEADERS[required.indexOf(header)]}".`, 'VALIDATION_ERROR');
    }
  });

  const index = Object.fromEntries(TEMPLATE_HEADERS.map((header) => [header, headers.indexOf(normalizeHeader(header))]));
  const seenSerials = new Set();
  const seenShares = new Set();
  const errors = [];
  const rows = [];

  matrix.slice(1).forEach((row, offset) => {
    const excelRow = offset + 2;
    if (row.every((value) => String(value || '').trim() === '')) return;
    const serial = requiredText(row[index['Α/Α']]);
    const shareNumber = requiredText(row[index['Αριθμός Μερίδας']]);
    const nominalNumber = requiredText(row[index['Αριθμός Ονομαστικού']]);
    const description = requiredText(row[index['Περιγραφή']]);
    const measurementUnit = requiredText(row[index['Μονάδα Μέτρησης']]);
    const quantityText = requiredText(row[index['Ποσότητα']]).replace(',', '.');
    const quantity = Number(quantityText);
    if (!serial || !shareNumber || !description || !measurementUnit || !quantityText) {
      errors.push(`Γραμμή ${excelRow}: το Α/Α, ο Αριθμός Μερίδας, η Περιγραφή, η Μονάδα Μέτρησης και η Ποσότητα είναι υποχρεωτικά.`);
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push(`Γραμμή ${excelRow}: η Ποσότητα πρέπει να είναι μη αρνητικός αριθμός.`);
      return;
    }
    if (seenSerials.has(serial)) errors.push(`Γραμμή ${excelRow}: διπλό Α/Α ${serial}.`);
    if (seenShares.has(shareNumber)) errors.push(`Γραμμή ${excelRow}: διπλός Αριθμός Μερίδας ${shareNumber}.`);
    seenSerials.add(serial);
    seenShares.add(shareNumber);
    rows.push({
      serial,
      shareNumber,
      nominalNumber,
      description,
      measurementUnit,
      quantity,
      mainMaterialNumber: requiredText(row[index['Αριθμός Κυρίου Υλικού']]),
      materialCategory: requiredText(row[index['Κατηγορία Υλικού']]) || 'Αναλώσιμα'
    });
  });

  if (errors.length) {
    throw new AppError(`Το αρχείο δεν μπορεί να εισαχθεί:\n${errors.slice(0, 12).join('\n')}`, 'VALIDATION_ERROR');
  }
  if (!rows.length) throw new AppError('Δεν βρέθηκαν γραμμές υλικών στο Excel.', 'VALIDATION_ERROR');
  return rows;
}

function requiredText(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

module.exports = {
  TEMPLATE_HEADERS,
  createInitialInventoryService,
  parseRows
};
