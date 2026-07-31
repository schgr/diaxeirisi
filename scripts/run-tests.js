const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const TEST_PATTERN = /\.test\.(?:js|mjs)$/;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'build',
  'build-temp',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'release',
  'temp',
  'tmp',
  'tmp-appdata',
  'tmp-electron-userdata',
  'tmp-localappdata'
]);
const IGNORED_COPY_PATTERN = /(?:-TECLAST|-Movies|\.bak|\.backup|\.codexbak)(?:\.test)?\.(?:js|mjs)$/i;

function normalizedRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function discoverTests(root = DEFAULT_ROOT) {
  const testsRoot = path.join(root, 'tests');
  if (!fs.existsSync(testsRoot)) return [];
  const discovered = [];
  const pending = [testsRoot];
  while (pending.length) {
    const directory = pending.pop();
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) pending.push(target);
      } else if (
        entry.isFile()
        && TEST_PATTERN.test(entry.name)
        && !IGNORED_COPY_PATTERN.test(entry.name)
      ) {
        discovered.push(normalizedRelative(root, target));
      }
    }
  }
  return discovered.sort((left, right) => left.localeCompare(right, 'en'));
}

function runTests(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const tests = discoverTests(root);
  if (!tests.length) {
    console.error('No test files were found.');
    return 1;
  }

  for (const test of tests) {
    console.log(`\n[test] ${test}`);
    const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', test], {
      cwd: root,
      env: { ...process.env, DCHSI_TEST_QUIET: '1' },
      stdio: 'inherit'
    });
    if (result.error) {
      console.error(`Unable to execute ${test}: ${result.error.message}`);
      return 1;
    }
    if (result.status !== 0) return result.status || 1;
  }
  console.log(`\nAll ${tests.length} test files passed.`);
  return 0;
}

if (require.main === module) {
  process.on('unhandledRejection', (error) => {
    throw error;
  });
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? process.argv[rootIndex + 1] : DEFAULT_ROOT;
  if (rootIndex >= 0 && !root) {
    console.error('Missing value for --root.');
    process.exitCode = 1;
  } else {
    process.exitCode = runTests({ root });
  }
}

module.exports = {
  DEFAULT_ROOT,
  IGNORED_DIRECTORIES,
  TEST_PATTERN,
  discoverTests,
  runTests
};
