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
const INTENTIONAL_TEST_ONLY_MODULES = new Set([
  'src/exhpForm/supportingDocs/shared/docHeader.js',
  'src/exhpForm/supportingDocs/shared/letteredList.js',
  'src/types/settings.types.js'
]);

function collectModules() {
  return execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((modulePath) => MODULE_PATTERN.test(modulePath) && fs.existsSync(path.join(ROOT, modulePath)))
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

function buildGraph() {
  const modules = collectModules();
  const knownModules = new Set(modules);
  const graph = new Map();
  for (const modulePath of modules) {
    const source = fs.readFileSync(path.join(ROOT, modulePath), 'utf8');
    const dependencies = extractSpecifiers(source)
      .map((specifier) => resolveLocalModule(modulePath, specifier, knownModules))
      .filter(Boolean);
    graph.set(modulePath, [...new Set(dependencies)].sort());
  }
  return { modules, graph };
}

function findReachable(graph) {
  const reachable = new Set();
  const pending = ENTRY_POINTS.slice();
  while (pending.length) {
    const current = pending.pop();
    if (reachable.has(current)) continue;
    if (!graph.has(current)) throw new Error(`Λείπει entry point: ${current}`);
    reachable.add(current);
    pending.push(...graph.get(current));
  }
  return reachable;
}

function analyze() {
  const { modules, graph } = buildGraph();
  const reachable = findReachable(graph);
  const orphans = modules.filter((modulePath) =>
    !reachable.has(modulePath) && !INTENTIONAL_TEST_ONLY_MODULES.has(modulePath)
  );
  return {
    entryPoints: ENTRY_POINTS,
    moduleCount: modules.length,
    reachableCount: reachable.size,
    orphans,
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
  }
  if (result.orphans.length) process.exitCode = 1;
}

module.exports = { ENTRY_POINTS, analyze, buildGraph, extractSpecifiers };
