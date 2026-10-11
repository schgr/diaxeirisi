const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { AppError } = require('../src/core/errorHandler');

const main = fs.readFileSync('src/main.js', 'utf8');
const printFunction = main.slice(
  main.indexOf('async function printCurrentDocument('),
  main.indexOf('\nasync function safeInvoke(')
);

async function checkPrint(legacy, landscape, outcome) {
  const calls = [];
  const printCurrentDocument = vm.runInNewContext(`${printFunction}; printCurrentDocument`, {
    isWindows7Legacy: legacy,
    sanitizeExportFilename: () => '',
    BrowserWindow: { fromWebContents: () => null }
  });
  const webContents = {
    executeJavaScript: async () => '',
    insertCSS: async (css, options) => {
      assert.match(css, /@page \{ size: A4 landscape; margin: 0; \}/u);
      assert.match(css, /@page portrait \{ size: A4 landscape; margin: 0; \}/u);
      assert.match(css, /@page landscape \{ size: A4 landscape; margin: 0; \}/u);
      assert.match(css, /\.isolated-print-root \* \{ page: auto !important; \}/u);
      assert.equal(options.cssOrigin, 'author');
      calls.push('insert');
      return 'legacy-style';
    },
    removeInsertedCSS: async (key) => {
      assert.equal(key, 'legacy-style');
      calls.push('remove');
    },
    print: (options, callback) => {
      calls.push('print');
      assert.equal(options.landscape, landscape);
      assert.equal(options.pageSize, 'A4');
      if (outcome === 'throw') throw new Error('Printer unavailable');
      callback(outcome === 'success', 'Print cancelled');
    }
  };
  if (outcome === 'throw') {
    await assert.rejects(printCurrentDocument(webContents, { landscape }), /Printer unavailable/u);
  } else {
    const result = await printCurrentDocument(webContents, { landscape });
    assert.equal(result.printed, outcome === 'success');
  }
  assert.deepEqual(calls, ['print']);
}

async function checkLegacyPdf(landscape, failure = '') {
  const calls = [];
  const tempDirectory = path.resolve('tmp', 'mock-legacy-print');
  const pdfPath = path.join(tempDirectory, 'Εκτύπωση-Δοκιμή.pdf');
  const pdf = Buffer.from('%PDF-1.7');
  const ownerWindow = { getTitle: () => 'Original window', setTitle: title => calls.push(`title:${title}`) };
  const printCurrentDocument = vm.runInNewContext(`${printFunction}; printCurrentDocument`, {
    isWindows7Legacy: true,
    sanitizeExportFilename: () => 'Δοκιμή',
    BrowserWindow: { fromWebContents: () => ownerWindow },
    AppError,
    path,
    app: { getPath: name => { assert.equal(name, 'temp'); return path.resolve('tmp'); } },
    fs: { promises: {
      mkdtemp: async prefix => { assert.equal(prefix, path.join(path.resolve('tmp'), 'dchsi-print-')); return tempDirectory; },
      writeFile: async (file, data) => {
        assert.equal(file, pdfPath);
        assert.equal(data, pdf);
        calls.push('write');
        if (failure === 'write') throw new Error('Write failed');
      }
    } },
    shell: { openPath: async file => {
      assert.equal(file, pdfPath);
      calls.push('open');
      return failure === 'open' ? 'No PDF reader' : '';
    } }
  });
  const orientation = landscape ? 'landscape' : 'portrait';
  const webContents = {
    executeJavaScript: async code => {
      if (code === 'document.title') return 'Original document';
      if (code.startsWith('(() => {')) {
        const css = JSON.parse(code.match(/style\.textContent = (.+);/u)[1]);
        for (const name of ['', ' landscape', ' portrait']) {
          assert.ok(css.includes(`@page${name} { size: A4 ${orientation}; margin: 0; }`));
        }
        assert.match(css, /page: auto !important/u);
        calls.push('insert');
      } else if (code.startsWith('document.getElementById(')) {
        calls.push('remove');
      } else {
        calls.push(`document:${code}`);
      }
    },
    print: () => assert.fail('Windows 7 must bypass native HTML printing'),
    printToPDF: async options => {
      assert.equal(options.landscape, landscape);
      assert.equal(options.pageSize, 'A4');
      assert.equal(options.preferCSSPageSize, true);
      assert.equal(options.scale, 1);
      assert.deepEqual(Object.values(options.margins), [0, 0, 0, 0]);
      calls.push('pdf');
      if (failure === 'pdf') throw new Error('PDF failed');
      return pdf;
    }
  };
  if (failure) {
    await assert.rejects(printCurrentDocument(webContents, { landscape, title: 'Δοκιμή' }),
      error => failure === 'open' ? error.code === 'PRINT_PDF_OPEN_FAILED' && error.message.includes(pdfPath) : error.message.includes('failed'));
  } else {
    const result = await printCurrentDocument(webContents, { landscape, title: 'Δοκιμή' });
    assert.equal(result.printed, false);
    assert.equal(result.openedPdf, true);
    assert.equal(result.filePath, pdfPath);
  }
  const operations = ['insert', 'pdf'];
  if (failure !== 'pdf') operations.push('write');
  if (!['pdf', 'write'].includes(failure)) operations.push('open');
  operations.push('remove');
  assert.deepEqual(calls.filter(call => !call.includes(':')), operations);
  assert.equal(calls.at(-1), 'title:Original window');
  assert.ok(calls.includes('document:document.title = "Original document"'));
}

(async () => {
  for (const legacy of [false]) {
    for (const landscape of [false, true]) {
      for (const outcome of ['success', 'cancel', 'throw']) {
        await checkPrint(legacy, landscape, outcome);
      }
    }
  }
  for (const landscape of [false, true]) {
    for (const failure of ['', 'pdf', 'write', 'open']) await checkLegacyPdf(landscape, failure);
  }
  for (const filename of ['electron-builder.win7.json', 'electron-builder.win7-x86.json']) {
    const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.equal(config.extraMetadata.buildFlavor, 'win7-legacy');
    assert.equal(config.extraMetadata.legacyWindows7, true);
  }
  console.log('Windows 7 PDF printing, failure recovery, and unchanged Windows 10/11 printing passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
