import assert from 'node:assert/strict';
import { renderExhpOtherSupportInputs } from '../src/ui/transactions/exhpSupportDocuments.js';

const html = renderExhpOtherSupportInputs('One; Two\nThree · Four|Five•Six;Seven;Eight');
assert.equal((html.match(/data-exhp-other-support/gu) || []).length, 8);
for (const value of ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']) {
  assert.match(html, new RegExp(`value="${value}"`, 'u'));
}

console.log('EXHP renders eight separate additional-support inputs.');
