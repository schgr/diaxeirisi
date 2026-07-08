const assert = require('assert');
const { calculateShareBalance } = require('../src/core/shareBalance');

const tests = [
  {
    label: 'deficit when accounting is above charged quantity',
    run() {
      const result = calculateShareBalance(10, 4);
      assert.strictEqual(result.status, 'Έλλειμμα');
      assert.strictEqual(result.statusTone, 'deficit');
      assert.strictEqual(result.availableQuantity, 6);
      assert.strictEqual(result.differenceQuantity, -6);
    }
  },
  {
    label: 'surplus when accounting is below charged quantity',
    run() {
      const result = calculateShareBalance(4, 10);
      assert.strictEqual(result.status, 'Πλεόνασμα');
      assert.strictEqual(result.statusTone, 'surplus');
      assert.strictEqual(result.availableQuantity, -6);
      assert.strictEqual(result.differenceQuantity, 6);
    }
  },
  {
    label: 'balanced when charged quantity equals accounting balance',
    run() {
      const result = calculateShareBalance(7, 7);
      assert.strictEqual(result.status, 'Ισοσκελισμένο');
      assert.strictEqual(result.statusTone, 'balanced');
      assert.strictEqual(result.availableQuantity, 0);
      assert.strictEqual(result.differenceQuantity, 0);
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

  console.log(`${passed}/${testCases.length} tests passed`);
  if (passed !== testCases.length) {
    process.exitCode = 1;
  }
}
