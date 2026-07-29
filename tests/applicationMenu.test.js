const assert = require('node:assert/strict');
const { shouldShowApplicationMenu } = require('../src/applicationMenu');

assert.equal(shouldShowApplicationMenu('0.13.214'), false);
assert.equal(shouldShowApplicationMenu('0.13.214-beta'), true);
assert.equal(shouldShowApplicationMenu('0.13.214-BETA.1'), true);
assert.equal(shouldShowApplicationMenu(''), false);

console.log('Application menu edition tests passed.');
