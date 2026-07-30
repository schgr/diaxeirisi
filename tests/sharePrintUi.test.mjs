import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderAllShareCardControls,
  renderAllShareCardPreview
} from '../src/ui/prints/shareCardPrint.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererSource = fs.readFileSync(
  path.join(root, 'src', 'ui', 'renderer.js'),
  'utf8'
);

assert.doesNotMatch(
  rendererSource,
  /legacy-offline-badge|legacyOfflineBadge/,
  'The legacy/offline badge must not be rendered in any build.'
);

const controls = renderAllShareCardControls(1485, {
  shareFrom: '',
  shareTo: ''
});
const orderedControls = [
  'print-share-from',
  'print-share-to',
  'print-current-document',
  'print-share-back-side'
];
let previousIndex = -1;
for (const id of orderedControls) {
  const index = controls.indexOf(`id="${id}"`);
  assert.ok(index > previousIndex, `${id} is missing or out of order.`);
  previousIndex = index;
}
assert.match(controls, /class="[^"]*all-share-controls[^"]*"/);

let progressListener;
let stopped = false;
globalThis.window = {
  appApi: {
    heavyTasks: {
      onProgress(listener) {
        progressListener = listener;
        return () => {
          stopped = true;
        };
      }
    }
  }
};

const preview = { innerHTML: '' };
const state = {
  activeTab: 'share-card',
  fiscalYear: 2026,
  shareFrom: '',
  shareTo: '',
  shareRenderToken: 0,
  sharePrintCards: [],
  sharePreviewPage: 0
};
await renderAllShareCardPreview(
  {
    async getCardsBatch() {
      return [{
        share: {
          id: 1,
          shareNumber: '1',
          nominalNumber: 'N-1',
          description: 'Δοκιμαστικό υλικό',
          materialCode: 'M-1',
          measurementUnit: 'ΤΕΜ',
          unitPrice: 1,
          accountingBalance: 0
        },
        year: 2026,
        openingTransfer: {
          balance: 0,
          inventoryDate: '2025-12-31',
          reference: 'Απογραφή'
        },
        transactions: []
      }];
    }
  },
  [{
    id: 1,
    shareNumber: '1',
    nominalNumber: 'N-1',
    description: 'Δοκιμαστικό υλικό',
    materialCode: 'M-1',
    measurementUnit: 'ΤΕΜ',
    unitPrice: 1,
    accountingBalance: 0
  }],
  {},
  state,
  preview
);
assert.ok(stopped, 'The progress subscription must be cleaned up.');
const completedPreview = preview.innerHTML;
assert.match(
  completedPreview,
  /share-preview-pagination/,
  'A completed batch must replace the progress bar with the share preview.'
);
assert.match(
  completedPreview,
  /official-share-page/,
  'A completed batch must render at least one material share page.'
);
progressListener({
  id: 'share-print-1',
  message: 'Προετοιμασία μερίδων…',
  current: 1,
  total: 1
});
assert.equal(
  preview.innerHTML,
  completedPreview,
  'A late progress event must not replace the completed preview.'
);

console.log('sharePrintUi.test.mjs: OK');
