import assert from 'node:assert/strict';
import { EXP_AITIOLOGIES } from '../src/exhpForm/aitiologies.js';
import { exhpDraftKey, scheduleExhpDraftSave } from '../src/ui/transactions/addy/addyState.js';

const savedDrafts = new Map();
globalThis.window = {
  appApi: {
    drafts: {
      save: async (key, data) => savedDrafts.set(key, structuredClone(data))
    }
  }
};

function draftContainer(reason) {
  const manualInput = { value: `Διαταγή για ${reason}` };
  return {
    querySelector(selector) {
      return {
        '#exhp-date': { value: '2026-09-09' },
        '#exhp-unit': { value: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ' },
        '#exhp-reason': { value: reason }
      }[selector] || null;
    },
    querySelectorAll(selector) {
      return selector === '[data-manual-exhp-support]' ? [manualInput] : [];
    }
  };
}

for (const { label } of EXP_AITIOLOGIES) {
  const support = {
    templateId: 101,
    completed: true,
    documentReference: `ΕΓΓΡΑΦΟ ${label}`,
    formData: { reason: label }
  };
  const state = {
    exhpItems: [{ shareNumber: '1' }],
    exhpDraftSupports: new Map([[support.templateId, support]]),
    exhpDocumentsState: {
      draftUselessA: { reason: label },
      draftUselessB: null,
      draftAmmo: null,
      newModuleDrafts: { test: { reason: label } },
      uselessStatements: {}
    }
  };
  await scheduleExhpDraftSave(draftContainer(label), state);
  const reloaded = savedDrafts.get(exhpDraftKey(label));
  assert.deepEqual(reloaded.supports, [support], `Official support must persist for ${label}.`);
  assert.deepEqual(
    reloaded.manualSupportDocuments,
    [`Διαταγή για ${label}`],
    `Manual support must persist for ${label}.`
  );
  assert.deepEqual(reloaded.documentDrafts.draftUselessA, { reason: label });
  assert.deepEqual(reloaded.documentDrafts.newModuleDrafts, { test: { reason: label } });
}

console.log(`EXHP draft supporting-document persistence passed for ${EXP_AITIOLOGIES.length} αιτιολογίες.`);
