import assert from 'node:assert/strict';
import { renderExhpOtherSupportInputs } from '../src/ui/transactions/exhpSupportDocuments.js';

const html = renderExhpOtherSupportInputs('One; Two\nThree · Four|Five•Six');
assert.equal((html.match(/data-exhp-other-support/gu) || []).length, 6);
for (const value of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
  assert.match(html, new RegExp(`value="${value}"`, 'u'));
}

console.log('EXHP renders six separate additional-support inputs.');
