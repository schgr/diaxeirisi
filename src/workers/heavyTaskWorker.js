const { parentPort } = require('worker_threads');
const path = require('path');

if (!parentPort) {
  throw new Error('heavyTaskWorker must run inside a worker thread');
}

let canceled = false;

parentPort.on('message', async (message) => {
  if (message && message.type === 'cancel') {
    canceled = true;
    return;
  }
  if (!message || message.type !== 'run') return;
  try {
    const result = await executeTask(message.task, message.payload || {}, reportProgress);
    checkCanceled();
    parentPort.postMessage({ type: 'result', result });
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: {
        message: error && error.message ? error.message : String(error),
        code: error && error.code ? error.code : 'WORKER_ERROR',
        stack: error && error.stack ? error.stack : ''
      }
    });
  }
});

function reportProgress(current, total, message) {
  checkCanceled();
  parentPort.postMessage({ type: 'progress', current, total, message });
}

function checkCanceled() {
  if (!canceled) return;
  const error = new Error('Η εργασία ακυρώθηκε.');
  error.code = 'WORKER_CANCELED';
  throw error;
}

async function executeTask(task, payload, progress) {
  if (task.startsWith('backup-')) {
    const { executeBackupTask } = require('./backupWorkerTasks');
    return executeBackupTask(task, payload, progress, checkCanceled);
  }
  if (task === 'export-document') {
    progress(0, 1, 'Δημιουργία αρχείου…');
    const { writeExcelExport, writeWordExport } = require('../services/documentExportService');
    if (payload.format === 'word') {
      writeWordExport(payload.filePath, payload.document);
    } else {
      await writeExcelExport(payload.filePath, payload.document);
    }
    progress(1, 1, 'Το αρχείο δημιουργήθηκε.');
    return payload.filePath;
  }
  if (task === 'read-excel-matrix') {
    const ExcelJS = require('exceljs');
    progress(0, 2, 'Ανάγνωση Excel…');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(payload.filePath);
    checkCanceled();
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      const error = new Error('Το αρχείο Excel δεν περιέχει φύλλο εργασίας.');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const matrix = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      matrix[rowNumber - 1] = row.values.slice(1).map(readCellValue);
      if (rowNumber % 250 === 0) progress(rowNumber, worksheet.rowCount, 'Ανάγνωση γραμμών…');
    });
    progress(2, 2, 'Το Excel αναγνώστηκε.');
    return matrix;
  }
  if (task === 'prepare-share-print') {
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    const prepared = [];
    for (let index = 0; index < cards.length; index += 100) {
      checkCanceled();
      prepared.push(...cards.slice(index, index + 100));
      progress(Math.min(index + 100, cards.length), cards.length, 'Προετοιμασία μερίδων…');
      await new Promise((resolve) => setImmediate(resolve));
    }
    return prepared;
  }
  if (task === 'database-integrity') {
    const initSqlJs = require('sql.js');
    progress(0, 2, 'Φόρτωση ασφαλούς snapshot…');
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(payload.sqlJsDirectory, file)
    });
    checkCanceled();
    const candidate = new SQL.Database(new Uint8Array(payload.snapshot));
    try {
      const result = candidate.exec('PRAGMA integrity_check');
      progress(2, 2, 'Ο έλεγχος ακεραιότητας ολοκληρώθηκε.');
      return {
        ok: result[0]?.values[0]?.[0] === 'ok',
        details: result.flatMap((set) => set.values.flat()).map(String)
      };
    } finally {
      candidate.close();
    }
  }
  if (task === '__test-delay') {
    const until = Date.now() + Number(payload.duration || 0);
    while (Date.now() < until) {
      checkCanceled();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return payload.value;
  }
  if (task === '__test-cpu') {
    const duration = Number(payload.duration || 100);
    const until = Date.now() + duration;
    let checksum = 0;
    while (Date.now() < until) {
      checksum = (checksum + Math.sqrt(checksum + 17)) % 1000003;
    }
    return { checksum, duration };
  }
  if (task === '__test-crash') {
    process.exit(23);
  }
  throw Object.assign(new Error(`Unknown heavy task: ${task}`), { code: 'WORKER_TASK_UNKNOWN' });
}

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
