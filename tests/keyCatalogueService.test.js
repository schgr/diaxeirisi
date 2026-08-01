'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKeyCatalogueService, findSearchFile } = require('../src/services/keyCatalogueService');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-key-catalogue-'));
  const dataDirectory = path.join(root, 'htdocs', '_next', 'data', 'build-test');
  fs.mkdirSync(dataDirectory, { recursive: true });
  const searchFile = path.join(dataDirectory, 'search.json');
  fs.writeFileSync(searchFile, JSON.stringify({
    pageProps: {
      allParts: [
        {
          nsn: '4210121557869',
          pn: 'TL4210-0080',
          name: 'ΕΞΑΡΤΗΜΑ ΠΥΡΟΣΒΕΣΗΣ',
          assembly: {
            catalogue: {
              name: 'ΣΚΑΦΟΣ',
              kyrio: { name: 'LEO 1A5' }
            }
          }
        },
        { nsn: '', pn: 'ABC-2', name: 'ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ' }
      ]
    }
  }), 'utf8');

  assert.strictEqual(findSearchFile(root), searchFile);
  assert.strictEqual(findSearchFile(path.join(root, 'missing')), null);

  const configFile = path.join(root, 'settings', 'key-catalogue.json');
  const service = createKeyCatalogueService({ configFile });
  assert.deepStrictEqual(service.status(), { configured: false });
  assert.deepStrictEqual(await service.search('4210'), { configured: false, items: [] });
  const configured = await service.configure(root);
  assert.deepStrictEqual(configured, { configured: true, itemCount: 2 });

  const byNominal = await service.search('4210121557869');
  assert.strictEqual(byNominal.items.length, 1);
  assert.deepStrictEqual(byNominal.items[0], {
    nominalNumber: '4210121557869',
    partNumber: 'TL4210-0080',
    description: 'ΕΞΑΡΤΗΜΑ ΠΥΡΟΣΒΕΣΗΣ',
    catalogue: 'ΣΚΑΦΟΣ',
    equipment: 'LEO 1A5'
  });
  assert.strictEqual((await service.search('πυροσβεσης leo')).items.length, 1);
  assert.strictEqual((await service.search('ανύπαρκτο')).items.length, 0);
  await service.close();
  const restored = createKeyCatalogueService({ configFile });
  assert.deepStrictEqual(await restored.initialize(), { configured: true, itemCount: 2 });
  assert.strictEqual((await restored.search('ABC-2')).items.length, 1);
  await restored.close();

  await assert.rejects(
    createKeyCatalogueService().configure(path.join(root, 'missing')),
    (error) => error.code === 'KEY_CATALOGUE_INVALID'
  );
  fs.rmSync(root, { recursive: true, force: true });
  console.log('keyCatalogueService.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
