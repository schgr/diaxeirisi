const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ENTRY_POINTS = [
  'src/main.js',
  'src/preload.js',
  'src/workers/heavyTaskWorker.js',
  'src/ui/renderer.js'
];
const MODULE_PATTERN = /\.(?:js|mjs)$/;
const DEVICE_COPY_PATTERN = /-(Movies|TECLAST)(?=\.js$)/i;
const PACKAGING_CONFIGS = [
  'package.json',
  'electron-builder.win-x86.json',
  'electron-builder.win7-x86.json',
  'electron-builder.win7.json',
  'electron-builder.beta.js'
];
const INTENTIONAL_TEST_ONLY_MODULES = new Set([
  'src/exhpForm/supportingDocs/shared/docHeader.js',
  'src/exhpForm/supportingDocs/shared/letteredList.js',
  'src/types/settings.types.js'
]);

function collectModules(root = ROOT) {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'src'],
    { cwd: root, encoding: 'utf8' }
  )
    .split(/\r?\n/)
    .filter((modulePath) =>
      MODULE_PATTERN.test(modulePath)
      && !DEVICE_COPY_PATTERN.test(modulePath)
      && fs.existsSync(path.join(root, modulePath))
    )
    .sort();
}

function extractSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveLocalModule(importer, specifier, knownModules) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}/index.js`,
    `${base}/index.mjs`
  ];
  return candidates.find((candidate) => knownModules.has(candidate)) || null;
}

function buildGraph(root = ROOT) {
  const modules = collectModules(root);
  const knownModules = new Set(modules);
  const graph = new Map();
  for (const modulePath of modules) {
    const source = fs.readFileSync(path.join(root, modulePath), 'utf8');
    const dependencies = extractSpecifiers(source)
      .map((specifier) => resolveLocalModule(modulePath, specifier, knownModules))
      .filter(Boolean);
    graph.set(modulePath, [...new Set(dependencies)].sort());
  }
  return { modules, graph };
}

function exportedNames(source) {
  const names = new Set();
  const declarations = /\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  const lists = /\bexport\s*\{([^}]+)\}(?!\s*from)/g;
  let match;
  while ((match = declarations.exec(source))) names.add(match[1]);
  while ((match = lists.exec(source))) {
    for (const item of match[1].split(',')) {
      const name = item.trim().split(/\s+as\s+/)[1] || item.trim().split(/\s+as\s+/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

function namedImportUsage(source, importer, knownModules) {
  const usage = new Map();
  const imports = /\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = imports.exec(source))) {
    const target = resolveLocalModule(importer, match[2], knownModules);
    if (!target) continue;
    if (!usage.has(target)) usage.set(target, new Set());
    for (const item of match[1].split(',')) {
      const imported = item.trim().split(/\s+as\s+/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(imported)) usage.get(target).add(imported);
    }
  }
  return usage;
}

function uncertainImportTargets(source, importer, knownModules) {
  const targets = new Set();
  const patterns = [
    /\bimport\s+(?!\{)[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s*['"]([^'"]+)['"]/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      const target = resolveLocalModule(importer, match[1], knownModules);
      if (target) targets.add(target);
    }
  }
  return targets;
}

function findUnusedExports(root, modules, reachable) {
  const knownModules = new Set(modules);
  const used = new Map();
  const usedByTests = new Map();
  const uncertain = new Set();
  for (const importer of modules) {
    const source = fs.readFileSync(path.join(root, importer), 'utf8');
    for (const [target, names] of namedImportUsage(source, importer, knownModules)) {
      if (!used.has(target)) used.set(target, new Set());
      names.forEach((name) => used.get(target).add(name));
    }
    uncertainImportTargets(source, importer, knownModules).forEach((target) => uncertain.add(target));
  }
  const testsRoot = path.join(root, 'tests');
  if (fs.existsSync(testsRoot)) {
    for (const entry of fs.readdirSync(testsRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:js|mjs)$/.test(entry.name)) continue;
      const importer = `tests/${entry.name}`;
      const source = fs.readFileSync(path.join(testsRoot, entry.name), 'utf8');
      for (const [target, names] of namedImportUsage(source, importer, knownModules)) {
        if (!usedByTests.has(target)) usedByTests.set(target, new Set());
        names.forEach((name) => usedByTests.get(target).add(name));
      }
    }
  }
  const result = [];
  for (const modulePath of modules) {
    if (!reachable.has(modulePath) || ENTRY_POINTS.includes(modulePath) || uncertain.has(modulePath)) continue;
    const source = fs.readFileSync(path.join(root, modulePath), 'utf8');
    const consumed = used.get(modulePath) || new Set();
    const testConsumed = usedByTests.get(modulePath) || new Set();
    for (const name of exportedNames(source)) {
      if (!consumed.has(name)) {
        result.push({ module: modulePath, export: name, testOnly: testConsumed.has(name) });
      }
    }
  }
  return result;
}

function findDeviceCopies(root = ROOT) {
  const result = [];
  const pending = [path.join(root, 'src')];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && DEVICE_COPY_PATTERN.test(entry.name)) {
        const relative = path.relative(root, target).replace(/\\/g, '/');
        const canonical = target.replace(DEVICE_COPY_PATTERN, '');
        const identicalTo = fs.existsSync(canonical)
          && fs.readFileSync(target).equals(fs.readFileSync(canonical))
          ? path.relative(root, canonical).replace(/\\/g, '/')
          : null;
        result.push({ path: relative, device: entry.name.match(DEVICE_COPY_PATTERN)[1], identicalTo });
      }
    }
  }
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function findStalePackagingPatterns(root = ROOT) {
  const deviceCopies = findDeviceCopies(root);
  const stale = [];
  for (const config of PACKAGING_CONFIGS) {
    const configPath = path.join(root, config);
    if (!fs.existsSync(configPath)) continue;
    const source = fs.readFileSync(configPath, 'utf8');
    const pattern = /!src\/\*\*\/\*-([A-Za-z0-9_-]+)\.js/g;
    let match;
    while ((match = pattern.exec(source))) {
      if (!deviceCopies.some((copy) => copy.device.toLowerCase() === match[1].toLowerCase())) {
        stale.push({ config, pattern: match[0] });
      }
    }
  }
  return stale;
}

function findReachable(graph, entryPoints = ENTRY_POINTS) {
  const reachable = new Set();
  const pending = entryPoints.slice();
  while (pending.length) {
    const current = pending.pop();
    if (reachable.has(current)) continue;
    if (!graph.has(current)) throw new Error(`Λείπει entry point: ${current}`);
    reachable.add(current);
    pending.push(...graph.get(current));
  }
  return reachable;
}

function analyze(root = ROOT) {
  const { modules, graph } = buildGraph(root);
  const reachable = findReachable(graph);
  const orphans = modules.filter((modulePath) =>
    !reachable.has(modulePath) && !INTENTIONAL_TEST_ONLY_MODULES.has(modulePath)
  );
  return {
    entryPoints: ENTRY_POINTS,
    moduleCount: modules.length,
    reachableCount: reachable.size,
    orphans,
    unusedExports: findUnusedExports(root, modules, reachable),
    stalePackagingPatterns: findStalePackagingPatterns(root),
    deviceCopies: findDeviceCopies(root),
    graph: Object.fromEntries([...graph.entries()])
  };
}

if (require.main === module) {
  const result = analyze();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Entry points: ${result.entryPoints.join(', ')}`);
    console.log(`Modules: ${result.moduleCount}; reachable: ${result.reachableCount}; orphans: ${result.orphans.length}`);
    result.orphans.forEach((modulePath) => console.error(`ORPHAN ${modulePath}`));
    result.unusedExports.forEach((item) =>
      console.warn(`${item.testOnly ? 'TEST_ONLY_EXPORT' : 'UNUSED_EXPORT'} ${item.module}#${item.export}`)
    );
    result.stalePackagingPatterns.forEach((item) =>
      console.error(`STALE_PACKAGING_PATTERN ${item.config}: ${item.pattern}`)
    );
    result.deviceCopies.forEach((item) =>
      console.warn(`DEVICE_COPY ${item.path}${item.identicalTo ? ` (duplicate of ${item.identicalTo})` : ''}`)
    );
  }
  if (result.orphans.length || result.stalePackagingPatterns.length) process.exitCode = 1;
}

module.exports = {
  ENTRY_POINTS,
  analyze,
  buildGraph,
  collectModules,
  exportedNames,
  extractSpecifiers,
  findDeviceCopies,
  findReachable,
  findStalePackagingPatterns,
  findUnusedExports,
  namedImportUsage
};
