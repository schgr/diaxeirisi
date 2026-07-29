const ExcelJS = require('exceljs');
const { AppError } = require('../core/errorHandler');
const { createSharesService } = require('./sharesService');

const COMPOSITION_HEADERS = [
  'Αριθμός Μερίδας',
  'Αριθμός Ονομαστικού',
  'Περιγραφή',
  'Μονάδα Μέτρησης',
  'Προβλεπόμενη Ποσότητα',
  'Υπάρχουσα Ποσότητα'
];

function createCompositionImportService(db) {
  const sharesService = createSharesService(db);

  return {
    async writeTemplate(filePath) {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'diaxeirisi Ylikoy';
      const sheet = workbook.addWorksheet('Συνθέσεις Μερίδων', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      sheet.addRow(COMPOSITION_HEADERS);

      sheet.columns = [
        { width: 20 }, { width: 26 }, { width: 48 }, { width: 20 }, { width: 24 }, { width: 22 }
      ];
      sheet.autoFilter = 'A1:F1';
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      sheet.getRow(1).height = 32;
      await workbook.xlsx.writeFile(filePath);
      return { filePath, message: 'Το πρότυπο συνθέσεων δημιουργήθηκε.' };
    },

    async importWorkbook(filePath) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new AppError('Το αρχείο Excel δεν περιέχει φύλλο εργασίας.', 'VALIDATION_ERROR');

      const matrix = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        matrix[rowNumber - 1] = row.values.slice(1).map(readCellValue);
      });
      const rows = parseCompositionRows(matrix);
      const shares = sharesService.listShares();
      const sharesByNumber = new Map(shares.map((share) => [normalizeKey(share.shareNumber), share]));
      const sharesByNominal = new Map(shares.map((share) => [normalizeKey(share.nominalNumber), share]));
      const groups = new Map();

      rows.forEach((row) => {
        let share = sharesByNumber.get(normalizeKey(row.shareNumber));
        if (!share) throw new AppError(`Δεν βρέθηκε η μερίδα ${row.shareNumber}.`, 'VALIDATION_ERROR');
        if (!share.requiresComposition) {
          share = sharesService.updateShareDetails(share.id, { requiresComposition: true });
          sharesByNumber.set(normalizeKey(row.shareNumber), share);
        }
        if (!groups.has(share.id)) groups.set(share.id, { share, rows: [] });
        groups.get(share.id).rows.push(row);
      });

      let importedRows = 0;
      for (const { share, rows: groupRows } of groups.values()) {
        const card = sharesService.getShareCard(share.id, new Date().getFullYear());
        const existingByNominal = new Map(
          card.compositionItems.map((item) => [normalizeKey(item.componentNominalNumber), item])
        );
        const balance = Number(card.share.accountingBalance || 0);
        const items = groupRows.map((row) => {
          const existing = existingByNominal.get(normalizeKey(row.nominalNumber));
          const componentShare = sharesByNominal.get(normalizeKey(row.nominalNumber));
          const projectedTotal = row.projectedQuantity * balance;
          return {
            componentNominalNumber: row.nominalNumber,
            componentDescription: row.description,
            measurementUnit: row.measurementUnit || existing?.measurementUnit || componentShare?.measurementUnit || '',
            projectedQuantity: row.projectedQuantity,
            notIssuedQuantity: Math.max(projectedTotal - row.existingQuantity, 0),
            notes: existing?.notes || ''
          };
        });
        sharesService.saveComposition(share.id, items);
        const openingDate = `${Number(card.year) - 1}-12-31`;
        sharesService.saveChangeSheet(
          share.id,
          groupRows.flatMap((row, index) => Number(row.existingQuantity) > 0 ? [{
            changeDate: openingDate,
            orderReference: 'Απογραφή',
            previousValue: '',
            newValue: String(row.existingQuantity),
            changeReason: 'Αρχική ενημέρωση σύνθεσης από Excel',
            notes: 'COMPOSITION_IMPORT_OPENING',
            componentLineNumber: index + 1,
            movementType: 'ΧΡΕΩΣΗ',
            quantity: row.existingQuantity
          }] : [])
        );
        importedRows += items.length;
      }

      return {
        updatedShares: groups.size,
        importedRows,
        message: `Ενημερώθηκαν ${groups.size} συνθέσεις με ${importedRows} γραμμές.`
      };
    }
  };
}

function parseCompositionRows(matrix) {
  if (!matrix.length) throw new AppError('Το αρχείο Excel είναι κενό.', 'VALIDATION_ERROR');
  const headers = matrix[0].map(normalizeHeader);
  COMPOSITION_HEADERS.forEach((header) => {
    if (!headers.includes(normalizeHeader(header))) {
      throw new AppError(`Λείπει η υποχρεωτική στήλη "${header}".`, 'VALIDATION_ERROR');
    }
  });
  const index = Object.fromEntries(
    COMPOSITION_HEADERS.map((header) => [header, headers.indexOf(normalizeHeader(header))])
  );
  const errors = [];
  const seen = new Set();
  const rows = [];

  matrix.slice(1).forEach((row, offset) => {
    if (row.every((value) => String(value ?? '').trim() === '')) return;
    const excelRow = offset + 2;
    const shareNumber = text(row[index['Αριθμός Μερίδας']]);
    const nominalNumber = text(row[index['Αριθμός Ονομαστικού']]);
    const description = text(row[index['Περιγραφή']]);
    const measurementUnit = text(row[index['Μονάδα Μέτρησης']]);
    const projectedQuantity = number(row[index['Προβλεπόμενη Ποσότητα']]);
    const existingQuantity = number(row[index['Υπάρχουσα Ποσότητα']]);
    if (!shareNumber || !nominalNumber || !description || !measurementUnit) {
      errors.push(`Γραμμή ${excelRow}: η μερίδα, ο αριθμός ονομαστικού, η περιγραφή και η μονάδα μέτρησης είναι υποχρεωτικά.`);
      return;
    }
    if (!Number.isFinite(projectedQuantity) || projectedQuantity <= 0) {
      errors.push(`Γραμμή ${excelRow}: η Προβλεπόμενη Ποσότητα πρέπει να είναι θετική.`);
      return;
    }
    if (!Number.isFinite(existingQuantity) || existingQuantity < 0) {
      errors.push(`Γραμμή ${excelRow}: η Υπάρχουσα Ποσότητα πρέπει να είναι μη αρνητική.`);
      return;
    }
    const key = `${normalizeKey(shareNumber)}|${normalizeKey(nominalNumber)}`;
    if (seen.has(key)) errors.push(`Γραμμή ${excelRow}: διπλή γραμμή σύνθεσης για ${shareNumber} / ${nominalNumber}.`);
    seen.add(key);
    rows.push({ shareNumber, nominalNumber, description, measurementUnit, projectedQuantity, existingQuantity });
  });
  if (errors.length) {
    throw new AppError(`Το αρχείο συνθέσεων δεν μπορεί να εισαχθεί:\n${errors.slice(0, 12).join('\n')}`, 'VALIDATION_ERROR');
  }
  if (!rows.length) throw new AppError('Δεν βρέθηκαν γραμμές συνθέσεων στο Excel.', 'VALIDATION_ERROR');
  return rows;
}

function readCellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.result !== undefined) return value.result;
    if (value.text !== undefined) return value.text;
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  }
  return value;
}

function normalizeHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase('el-GR');
}

function normalizeKey(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  return Number(String(value ?? '').trim().replace(',', '.'));
}

module.exports = { COMPOSITION_HEADERS, createCompositionImportService, parseCompositionRows };
