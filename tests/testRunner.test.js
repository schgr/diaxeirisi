const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { discoverTests } = require('../scripts/run-tests');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-test-runner-'));
try {
  const tests = path.join(root, 'tests');
  fs.mkdirSync(tests, { recursive: true });
  fs.writeFileSync(path.join(tests, 'z-last.test.mjs'), 'console.log("z-last");\n');
  fs.writeFileSync(path.join(tests, 'a-new-temporary.test.js'),
    'require("fs").writeFileSync("discovered.marker", "yes");\n');
  fs.writeFileSync(path.join(tests, 'ignored-TECLAST.test.js'),
    'process.exitCode = 99;\n');
  fs.mkdirSync(path.join(tests, 'tmp'));
  fs.writeFileSync(path.join(tests, 'tmp', 'ignored.test.js'), 'process.exitCode = 99;\n');

  assert.deepStrictEqual(discoverTests(root), [
    'tests/a-new-temporary.test.js',
    'tests/z-last.test.mjs'
  ]);

  const execution = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'scripts', 'run-tests.js'),
    '--root',
    root
  ], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(execution.status, 0, execution.stderr || execution.stdout);
  assert.strictEqual(fs.readFileSync(path.join(root, 'discovered.marker'), 'utf8'), 'yes');

  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-test-runner-empty-'));
  try {
    fs.mkdirSync(path.join(emptyRoot, 'tests'));
    const empty = spawnSync(process.execPath, [
      path.join(__dirname, '..', 'scripts', 'run-tests.js'),
      '--root',
      emptyRoot
    ], { cwd: emptyRoot, encoding: 'utf8' });
    assert.notStrictEqual(empty.status, 0);
    assert.match(empty.stderr, /No test files were found/);
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }

  const rejectionRoot = path.join(root, 'rejection-suite');
  try {
    fs.mkdirSync(path.join(rejectionRoot, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(rejectionRoot, 'tests', 'rejection.test.js'),
      'Promise.reject(new Error("unhandled test rejection"));\nsetTimeout(() => {}, 20);\n');
    assert.deepStrictEqual(discoverTests(rejectionRoot), ['tests/rejection.test.js']);
    const rejection = spawnSync(process.execPath, [
      path.join(__dirname, '..', 'scripts', 'run-tests.js'),
      '--root',
      rejectionRoot
    ], { cwd: rejectionRoot, encoding: 'utf8' });
    assert.notStrictEqual(rejection.status, 0);
    assert.match(rejection.stderr, /unhandled test rejection/);
  } finally {
    fs.rmSync(rejectionRoot, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Automatic test discovery self-test passed.');
