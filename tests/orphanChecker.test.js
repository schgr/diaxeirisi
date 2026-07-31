const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  exportedNames,
  findDeviceCopies,
  findReachable,
  findStalePackagingPatterns,
  findUnusedExports
} = require('../scripts/check-orphan-modules');

assert.deepStrictEqual(exportedNames(`
  export function alpha() {}
  export const beta = 1;
  const local = 2;
  export { local as publicName };
`), ['alpha', 'beta', 'publicName']);

const graph = new Map([
  ['src/main.js', ['src/reachable.js']],
  ['src/reachable.js', []],
  ['src/orphan.js', []]
]);
assert.deepStrictEqual(
  [...findReachable(graph, ['src/main.js'])].sort(),
  ['src/main.js', 'src/reachable.js']
);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-orphan-checker-'));
try {
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'entry.js'),
    "import { used } from './library.js';\nconsole.log(used);\n");
  fs.writeFileSync(path.join(root, 'src', 'library.js'),
    'export const used = 1;\nexport const unused = 2;\n');
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'tests', 'library.test.mjs'),
    "import { unused } from '../src/library.js';\nconsole.log(unused);\n");
  const unused = findUnusedExports(
    root,
    ['src/entry.js', 'src/library.js'],
    new Set(['src/entry.js', 'src/library.js'])
  );
  assert.deepStrictEqual(unused, [{
    module: 'src/library.js',
    export: 'unused',
    testOnly: true
  }]);

  fs.writeFileSync(path.join(root, 'src', 'screen.js'), 'same\n');
  fs.writeFileSync(path.join(root, 'src', 'screen-TECLAST.js'), 'same\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    build: {
      files: ['src/**/*', '!src/**/*-TECLAST.js', '!src/**/*-Movies.js']
    }
  }));
  const copies = findDeviceCopies(root);
  assert.deepStrictEqual(copies, [{
    path: 'src/screen-TECLAST.js',
    device: 'TECLAST',
    identicalTo: 'src/screen.js'
  }]);
  assert.deepStrictEqual(findStalePackagingPatterns(root), [{
    config: 'package.json',
    pattern: '!src/**/*-Movies.js'
  }]);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('Orphan checker diagnostics test passed.');
