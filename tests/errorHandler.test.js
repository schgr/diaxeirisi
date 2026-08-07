const assert = require('assert');
const { AppError, toAppError } = require('../src/core/errorHandler');
const { createLogger } = require('../src/utils/logger');

const appError = new AppError('Λείπει ο αριθμός μερίδας.', 'VALIDATION_ERROR', { field: 'shareNumber' });
assert.ok(appError instanceof Error);
assert.strictEqual(appError.name, 'AppError');
assert.deepStrictEqual(toAppError(appError), {
  message: 'Λείπει ο αριθμός μερίδας.',
  code: 'VALIDATION_ERROR',
  details: { field: 'shareNumber' }
});

const defaults = new AppError('Σφάλμα');
assert.deepStrictEqual(toAppError(defaults), {
  message: 'Σφάλμα',
  code: 'APP_ERROR',
  details: null
});

const unexpected = toAppError(new TypeError('boom'));
assert.strictEqual(unexpected.code, 'UNEXPECTED_ERROR');
assert.strictEqual(unexpected.details, null);
assert.doesNotMatch(unexpected.message, /boom/, 'internal error text must not leak to the renderer');
assert.deepStrictEqual(toAppError(null), unexpected);
assert.deepStrictEqual(toAppError('string failure'), unexpected);

const originalLog = console.log;
const originalError = console.error;
const originalQuiet = process.env.DCHSI_TEST_QUIET;
const logged = [];
const errored = [];
console.log = (...args) => logged.push(args);
console.error = (...args) => errored.push(args);

try {
  const logger = createLogger('tests');

  process.env.DCHSI_TEST_QUIET = '1';
  logger.info('σιωπηλό μήνυμα');
  assert.strictEqual(logged.length, 0, 'info messages stay silent while tests run');

  delete process.env.DCHSI_TEST_QUIET;
  logger.info('πληροφορία');
  logger.warn('προειδοποίηση', { shareId: 4 });
  logger.error('σφάλμα');
  logger.error('σφάλμα με λεπτομέρειες', { code: 'X' });

  assert.strictEqual(logged.length, 2);
  assert.match(logged[0][0], /^\[[^\]]+\] \[info\] \[tests\] πληροφορία$/u);
  assert.strictEqual(logged[0].length, 1);
  assert.match(logged[1][0], /\[warn\] \[tests\] προειδοποίηση$/u);
  assert.deepStrictEqual(logged[1][1], { shareId: 4 });

  assert.strictEqual(errored.length, 2);
  assert.match(errored[0][0], /\[error\] \[tests\] σφάλμα$/u);
  assert.deepStrictEqual(errored[1][1], { code: 'X' });
} finally {
  console.log = originalLog;
  console.error = originalError;
  if (originalQuiet === undefined) delete process.env.DCHSI_TEST_QUIET;
  else process.env.DCHSI_TEST_QUIET = originalQuiet;
}

console.log('errorHandler.test.js: OK');
