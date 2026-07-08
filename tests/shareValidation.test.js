const assert = require('assert');
const { AppError } = require('../src/core/errorHandler');
const { validateShare } = require('../src/shares/shareValidation');

const validPayload = {
  shareNumber: '12',
  nominalNumber: '1005007265655',
  description: 'Υλικό δοκιμής',
  materialType: 'Αναλώσιμο',
  materialCode: 'MAT-12',
  projectedQuantity: 20,
  accountingBalance: 10,
  chargedQuantity: 4
};

const tests = [
  {
    label: 'rejects an empty share number',
    run() {
      assertValidationError({ ...validPayload, shareNumber: '' });
    }
  },
  {
    label: 'rejects an empty description',
    run() {
      assertValidationError({ ...validPayload, description: '' });
    }
  },
  {
    label: 'rejects an empty material type',
    run() {
      assertValidationError({ ...validPayload, materialType: '' });
    }
  },
  {
    label: 'rejects a negative accounting balance',
    run() {
      assertValidationError({ ...validPayload, accountingBalance: -1 });
    }
  },
  {
    label: 'rejects a negative charged quantity',
    run() {
      assertValidationError({ ...validPayload, chargedQuantity: -1 });
    }
  },
  {
    label: 'returns the validated share when all fields are valid',
    run() {
      assert.deepStrictEqual(validateShare(validPayload), validPayload);
    }
  }
];

runTests(tests);

function assertValidationError(payload) {
  assert.throws(
    () => validateShare(payload),
    (error) => error instanceof AppError && error.code === 'VALIDATION_ERROR'
  );
}

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

  console.log(`${passed}/${testCases.length} tests passed`);
  if (passed !== testCases.length) {
    process.exitCode = 1;
  }
}
