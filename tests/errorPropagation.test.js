const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AppError, toAppError } = require('../src/core/errorHandler');
const { parseStoredJson, parseStoredJsonArray } = require('../src/utils/safeJson');
const { atomicPersist } = require('../src/db/atomicPersistence');

const tests = [
  {
    label: 'application errors keep their message, code and details',
    run() {
      const result = toAppError(new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND', { id: 4 }));
      assert.deepStrictEqual(result, {
        message: 'Η μερίδα δεν βρέθηκε.',
        code: 'NOT_FOUND',
        details: { id: 4 }
      });
    }
  },
  {
    label: 'machine readable codes of unexpected errors reach the renderer',
    run() {
      const failure = Object.assign(new Error('worker timed out'), { code: 'WORKER_TIMEOUT' });
      const result = toAppError(failure);
      assert.strictEqual(result.code, 'WORKER_TIMEOUT');
      assert.strictEqual(result.message, 'Παρουσιάστηκε απρόβλεπτο σφάλμα.');
      assert.strictEqual(result.details, null);
    }
  },
  {
    label: 'unknown or unsafe codes fall back to UNEXPECTED_ERROR',
    run() {
      assert.strictEqual(toAppError(new Error('boom')).code, 'UNEXPECTED_ERROR');
      assert.strictEqual(toAppError({ code: 'C:\\secret\\path' }).code, 'UNEXPECTED_ERROR');
      assert.strictEqual(toAppError(undefined).code, 'UNEXPECTED_ERROR');
    }
  },
  {
    label: 'malformed stored JSON falls back without throwing',
    run() {
      assert.deepStrictEqual(parseStoredJson('{"a":1}', {}, 'test'), { a: 1 });
      assert.deepStrictEqual(parseStoredJson('{oops', {}, 'test'), {});
      assert.deepStrictEqual(parseStoredJson('', [], 'test'), []);
      assert.strictEqual(parseStoredJson('null', null, 'test'), null);
      assert.deepStrictEqual(parseStoredJsonArray('{"a":1}', 'test'), []);
      assert.deepStrictEqual(parseStoredJsonArray('[1,2]', 'test'), [1, 2]);
    }
  },
  {
    label: 'atomic persistence reports cleanup failures alongside the original error',
    run() {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-atomic-'));
      const dbPath = path.join(directory, 'dchsi.sqlite');
      const io = {
        ...fs,
        openSync: () => {
          throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        },
        unlinkSync: () => {
          throw Object.assign(new Error('locked'), { code: 'EBUSY' });
        }
      };
      assert.throws(
        () => atomicPersist(dbPath, Buffer.from('payload'), { fs: io }),
        (error) => {
          assert.strictEqual(error.code, 'ENOSPC');
          assert.strictEqual(error.suppressed.length, 1);
          assert.strictEqual(error.suppressed[0].code, 'EBUSY');
          return true;
        }
      );
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
];

runTests(tests);

function runTests(testCases) {
  let passed = 0;

  for (const test of testCases) {
    try {
      test.run();
      passed += 1;
      console.log(`✓ ${test.label}`);
    } catch (error) {
      console.error(`✗ ${test.label}`);
      console.error(`  ${error.message}`);
    }
  }

  console.log(`${passed}/${testCases.length} error propagation tests passed`);
  if (passed !== testCases.length) {
    process.exitCode = 1;
  }
}
