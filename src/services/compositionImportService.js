const { AppError } = require('../core/errorHandler');
const { normalizeHeaderText, normalizeText: normalizeKey } = require('../core/text');
const {
  applyTemplateHeaderStyle,
  createTemplateWorkbook,
  readFirstWorksheet,
  worksheetToMatrix
} = require('../utils/excel');
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
      const workbook = createTemplateWorkbook();
      const sheet = workbook.addWorksheet('Συνθέσεις Μερίδων', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });
      sheet.addRow(COMPOSITION_HEADERS);

      sheet.columns = [
        { width: 20 }, { width: 26 }, { width: 48 }, { width: 20 }, { width: 24 }, { width: 22 }
      ];
      sheet.autoFilter = 'A1:F1';
      applyTemplateHeaderStyle(sheet);
      addInstructionsSheet(workbook);
      await workbook.xlsx.writeFile(filePath);
      return { filePath, message: 'Το πρότυπο συνθέσεων δημιουργήθηκε.' };
    },

    async importWorkbook(filePath, inventoryDate) {
      const worksheet = await readFirstWorksheet(filePath);
      if (!worksheet) throw new AppError('Το αρχείο Excel δεν περιέχει φύλλο εργασίας.', 'VALIDATION_ERROR');
      return this.importMatrix(worksheetToMatrix(worksheet), inventoryDate);
    },

    importMatrix(matrix, inventoryDate) {
      const openingDate = requireInventoryDate(inventoryDate);
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
        const card = sharesService.getShareCard(share.id, Number(openingDate.slice(0, 4)) + 1);
        const existingByNominal = new Map(
          card.compositionItems.map((item) => [normalizeKey(item.componentNominalNumber), item])
        );
        const balance = Number(card.share.accountingBalance || 0);
        const items = groupRows.map((row) => {
          const existing = row.nominalNumber ? existingByNominal.get(normalizeKey(row.nominalNumber)) : undefined;
          const componentShare = row.nominalNumber ? sharesByNominal.get(normalizeKey(row.nominalNumber)) : undefined;
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

function requireInventoryDate(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('Συμπληρώστε την ημερομηνία τελευταίας ετήσιας απογραφής.', 'VALIDATION_ERROR');
  }
  if (date > new Date().toISOString().slice(0, 10)) {
    throw new AppError('Η ημερομηνία δεν μπορεί να είναι μελλοντική.', 'VALIDATION_ERROR');
  }
  return date;
}

function parseCompositionRows(matrix) {
  if (!matrix.length) throw new AppError('Το αρχείο Excel είναι κενό.', 'VALIDATION_ERROR');
  const headers = matrix[0].map(normalizeHeaderText);
  COMPOSITION_HEADERS.forEach((header) => {
    if (!headers.includes(normalizeHeaderText(header))) {
      throw new AppError(`Λείπει η υποχρεωτική στήλη "${header}".`, 'VALIDATION_ERROR');
    }
  });
  const index = Object.fromEntries(
    COMPOSITION_HEADERS.map((header) => [header, headers.indexOf(normalizeHeaderText(header))])
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
    if (!shareNumber || !description || !measurementUnit) {
      errors.push(`Γραμμή ${excelRow}: η μερίδα, η περιγραφή και η μονάδα μέτρησης είναι υποχρεωτικά.`);
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
    const componentKey = nominalNumber || `${description}|${measurementUnit}`;
    const key = `${normalizeKey(shareNumber)}|${normalizeKey(componentKey)}`;
    if (seen.has(key)) errors.push(`Γραμμή ${excelRow}: διπλή γραμμή σύνθεσης για ${shareNumber} / ${componentKey}.`);
    seen.add(key);
    rows.push({ shareNumber, nominalNumber, description, measurementUnit, projectedQuantity, existingQuantity });
  });
  if (errors.length) {
    throw new AppError(`Το αρχείο συνθέσεων δεν μπορεί να εισαχθεί:\n${errors.slice(0, 12).join('\n')}`, 'VALIDATION_ERROR');
  }
  if (!rows.length) throw new AppError('Δεν βρέθηκαν γραμμές συνθέσεων στο Excel.', 'VALIDATION_ERROR');
  return rows;
}

function addInstructionsSheet(workbook) {
  const sheet = workbook.addWorksheet('Οδηγίες');
  sheet.columns = [{ width: 30 }, { width: 92 }];
  sheet.addRow(['Πεδίο', 'Οδηγίες συμπλήρωσης']);
  sheet.addRows([
    ['Αριθμός Μερίδας', 'Η Μερίδα Υλικού που έχει σύνθεση.'],
    ['Αριθμός Ονομαστικού', 'Ο αριθμός ονομαστικού των υλικών της συλλογής. Η συμπλήρωση είναι προαιρετική.'],
    ['Μονάδα Μέτρησης', 'Η μονάδα μέτρησης του υλικού της συλλογής.'],
    ['Προβλεπόμενη Ποσότητα', 'Η προβλεπόμενη ποσότητα για 1 υλικό.'],
    ['Υπάρχουσα Ποσότητα', 'Η ποσότητα του Φύλλου Μεταβολών την 31-12 του προηγούμενου οικονομικού έτους.']
  ]);
  applyTemplateHeaderStyle(sheet, { height: 26, wrapText: false });
  sheet.getColumn(1).font = { bold: true };
  sheet.getColumn(2).alignment = { vertical: 'top', wrapText: true };
  for (let row = 2; row <= 6; row += 1) sheet.getRow(row).height = 34;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  return Number(String(value ?? '').trim().replace(',', '.'));
}

module.exports = { COMPOSITION_HEADERS, createCompositionImportService, parseCompositionRows };
