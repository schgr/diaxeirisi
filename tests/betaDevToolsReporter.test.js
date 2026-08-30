const assert = require('node:assert/strict');
const {
  createBetaDevToolsReporter,
  installConsoleErrorMirror,
  serializeDiagnostic
} = require('../src/betaDevToolsReporter');

assert.deepEqual(serializeDiagnostic(new Error('Δοκιμαστικό σφάλμα')).message, 'Δοκιμαστικό σφάλμα');

const sent = [];
const reporter = createBetaDevToolsReporter({
  enabled: true,
  send: async (entry) => sent.push(entry)
});
reporter.report('Σφάλμα πριν φορτώσει το παράθυρο', new Error('Λεπτομέρεια'));
assert.equal(sent.length, 0);
reporter.setRendererReady().then(() => {
  assert.equal(sent.length, 1);
  assert.equal(sent[0].source, 'Κύρια διεργασία');
  assert.equal(sent[0].details[0], 'Σφάλμα πριν φορτώσει το παράθυρο');
  assert.equal(sent[0].details[1].message, 'Λεπτομέρεια');

  const written = [];
  const fakeConsole = { error: (...values) => written.push(values) };
  const mirrored = [];
  const restore = installConsoleErrorMirror({
    enabled: true,
    reporter: { report: (...values) => mirrored.push(values) },
    consoleObject: fakeConsole
  });
  fakeConsole.error('Σφάλμα εφαρμογής');
  restore();
  assert.deepEqual(written, [['Σφάλμα εφαρμογής']]);
  assert.deepEqual(mirrored, [['Σφάλμα εφαρμογής']]);
  console.log('Beta DevTools reporter tests passed.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
