const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildGraph } = require('./check-orphan-modules');

const ROOT = path.resolve(__dirname, '..');
const TEST_ONLY_EXCLUSIONS = Object.freeze([
  'src/exhpForm/supportingDocs/shared/docHeader.js',
  'src/exhpForm/supportingDocs/shared/letteredList.js'
]);
const REQUIRED_PATTERNS = Object.freeze([
  'src/**/*',
  '!src/types/**/*',
  '!src/**/README.md',
  '!src/**/*.codexbak',
  ...TEST_ONLY_EXCLUSIONS.map((file) => `!${file}`),
  '!node_modules/**/*.codexbak',
  'build/icon.ico',
  'package.json'
]);
const REQUIRED_FILES = Object.freeze([
  'build/icon.ico',
  'build/installer.nsh',
  'src/main.js',
  'src/preload.js',
  'src/ui/index.html',
  'src/ui/package.json',
  'src/exhpForm/package.json',
  'src/workers/heavyTaskWorker.js',
  'src/workers/backupWorkerTasks.js',
  'node_modules/sql.js/dist/sql-wasm.wasm'
]);
const CONFIG_FILES = Object.freeze([
  'package.json',
  'electron-builder.win-x86.json',
  'electron-builder.win7.json',
  'electron-builder.win7-x86.json'
]);
const FORBIDDEN_TRACKED_PREFIXES = Object.freeze([
  '.db-check-',
  '.publish-site-',
  'build-temp/',
  'output/',
  'release/',
  'tmp/',
  'tmp-appdata/',
  'tmp-electron-userdata/',
  'tmp-localappdata/'
]);
const FORBIDDEN_PACKAGE_COPIES = Object.freeze([
  'package-ULTRAPC.json',
  'package-lock-ULTRAPC.json'
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function buildFiles(configFile) {
  const config = readJson(configFile);
  return configFile === 'package.json' ? config.build.files : config.files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateProductionExclusions() {
  const { graph } = buildGraph(ROOT);
  for (const excluded of TEST_ONLY_EXCLUSIONS) {
    const callers = [...graph.entries()]
      .filter(([, dependencies]) => dependencies.includes(excluded))
      .map(([modulePath]) => modulePath);
    assert(
      callers.length === 0,
      `Packaged production code depends on excluded module ${excluded}: ${callers.join(', ')}`
    );
  }
}

function validateTrackedFiles() {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => file.replace(/\\/g, '/'));
  } catch (error) {
    throw new Error(`Unable to inspect tracked packaging files: ${error.message}`);
  }
  for (const file of tracked) {
    assert(
      !FORBIDDEN_TRACKED_PREFIXES.some((prefix) => file.startsWith(prefix)),
      `Generated artifact is tracked: ${file}`
    );
    assert(!FORBIDDEN_PACKAGE_COPIES.includes(file), `Machine-specific package copy is tracked: ${file}`);
  }
  try {
    execFileSync('git', ['check-ignore', 'build/installer.nsh'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    throw new Error('build/installer.nsh is still ignored by Git.');
  } catch (error) {
    if (error.message === 'build/installer.nsh is still ignored by Git.') throw error;
    assert(error.status === 1, `Unable to verify installer include ignore state: ${error.message}`);
  }
}

function validateLockfile() {
  const packageMetadata = readJson('package.json');
  const lock = readJson('package-lock.json');
  const root = lock.packages && lock.packages[''];
  const electron = lock.packages && lock.packages['node_modules/electron'];
  const electronBuilder = lock.packages && lock.packages['node_modules/electron-builder'];
  const excelJs = lock.packages && lock.packages['node_modules/exceljs'];
  const uuidNodes = Object.entries(lock.packages || {})
    .filter(([packagePath]) => /(?:^|node_modules\/)uuid$/.test(packagePath));
  assert(root.devDependencies.electron === '^42.10.1', 'Lockfile Electron range differs from package.json.');
  assert(
    root.devDependencies['electron-builder'] === '^26.15.3',
    'Lockfile electron-builder range differs from package.json.'
  );
  assert(electron.version === '42.10.1', `Expected Electron 42.10.1, found ${electron.version}.`);
  assert(
    electronBuilder.version === '26.15.3',
    `Expected electron-builder 26.15.3, found ${electronBuilder.version}.`
  );
  assert(excelJs.version === '4.4.0', `Expected ExcelJS 4.4.0, found ${excelJs.version}.`);
  assert(uuidNodes.length === 1, `Expected one UUID installation, found ${uuidNodes.length}.`);
  assert(uuidNodes[0][1].version === '11.1.1', `Expected UUID 11.1.1, found ${uuidNodes[0][1].version}.`);
  assert(
    packageMetadata.overrides?.exceljs?.uuid === '^11.1.1',
    'ExcelJS UUID override must remain ^11.1.1.'
  );
  assert(
    readJson('electron-builder.win-x86.json').electronVersion === electron.version,
    'Windows x86 Electron version differs from the installed primary Electron version.'
  );
}

function main() {
  for (const file of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(ROOT, file)), `Required packaging file is missing: ${file}`);
  }
  for (const file of FORBIDDEN_PACKAGE_COPIES) {
    assert(!fs.existsSync(path.join(ROOT, file)), `Obsolete package copy exists: ${file}`);
  }
  for (const configFile of CONFIG_FILES) {
    const patterns = buildFiles(configFile);
    assert(Array.isArray(patterns), `${configFile} does not define a files array.`);
    assert(
      JSON.stringify(patterns) === JSON.stringify(REQUIRED_PATTERNS),
      `${configFile} packaging patterns differ from the validated baseline.`
    );
  }
  assert(readJson('src/ui/package.json').type === 'module', 'UI ESM package boundary is missing.');
  assert(readJson('src/exhpForm/package.json').type === 'module', 'EXHP ESM package boundary is missing.');
  validateProductionExclusions();
  validateTrackedFiles();
  validateLockfile();
  console.log('Packaging validation passed: production exclusions, runtime files, artifacts and UUID tree are valid.');
}

main();
