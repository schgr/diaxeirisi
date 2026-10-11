import assert from 'node:assert/strict';
import { isLandscapeExhpDocument } from '../src/ui/transactions/exhp/officialDocuments/officialDocumentPrint.js';

assert.equal(isLandscapeExhpDocument('<div class="faithful-form-page faithful-form-page-landscape"></div>'), true);
assert.equal(isLandscapeExhpDocument('<article class="exhp-faithful-page"></article>'), true);
assert.equal(isLandscapeExhpDocument('<article class="faithful-form-page"></article>'), false);
assert.equal(isLandscapeExhpDocument('<article class="official-overlay-page dyp192-page"></article>'), false);

console.log('Official EXHP document print orientation test passed.');
