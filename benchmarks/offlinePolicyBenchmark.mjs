import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { createOfflinePolicy } = require('../src/offlinePolicy');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-offline-benchmark-'));

try {
  const appPath = path.join(root, 'app');
  const userDataPath = path.join(root, 'user-data');
  const assetPath = path.join(appPath, 'src', 'ui', 'renderer.js');
  const photoPath = path.join(userDataPath, 'photos', 'photo.png');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.mkdirSync(path.dirname(photoPath), { recursive: true });
  fs.writeFileSync(assetPath, 'export {};');
  fs.writeFileSync(photoPath, 'photo');
  const policy = createOfflinePolicy({ appPath, userDataPath });
  const urls = [
    pathToFileURL(assetPath).href,
    pathToFileURL(photoPath).href,
    'https://example.test/fetch',
    'wss://example.test/socket',
    'data:text/plain,blocked',
    pathToFileURL(path.join(root, 'outside.txt')).href
  ];
  const iterations = 10000;
  let allowed = 0;
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    if (policy.isAllowedRequestUrl(urls[index % urls.length])) allowed += 1;
  }
  const elapsedMs = performance.now() - started;
  const result = {
    deterministic: true,
    iterations,
    allowed,
    blocked: iterations - allowed,
    elapsedMs,
    checksPerSecond: iterations / (elapsedMs / 1000),
    budgetMs: 2000,
    passed: elapsedMs <= 2000
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
