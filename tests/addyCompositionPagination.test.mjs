import assert from 'node:assert/strict';
import { renderAddyCompositionDocument } from '../src/ui/transactions/addyPrint.js';
import { renderCompositionDocument } from '../src/ui/shares/shareComposition.js';

for (const count of [0, 1, 26, 27, 59, 60, 92, 93]) {
  const composition = Array.from({ length: count }, (_, index) => ({
    componentNominalNumber: `COMP-${index + 1}`,
    componentDescription: `ΥΛΙΚΟ ${index + 1}`,
    measurementUnit: 'Τεμάχια', projectedQuantity: 1, notIssuedQuantity: 0
  }));
  const html = renderAddyCompositionDocument({
    id: 12, documentDate: '2026-10-03', transactionUnit: 'ΜΟΝΑΔΑ', financialOfficers: {}
  }, [{ column12: '123', column13: 'ΣΥΛΛΟΓΗ', column24: '10', composition }]);
  const shareHtml = renderCompositionDocument({
    share: { shareNumber: '10', nominalNumber: '123', description: 'ΣΥΛΛΟΓΗ' },
    compositionItems: composition
  }, {});
  for (const rendered of [html, shareHtml]) {
  const pages = rendered.split('<article').slice(1);
  assert.equal(pages.length, 1 + Math.ceil(Math.max(0, count - 26) / 33));
  pages.forEach((page, index) => {
    const startIndex = index === 0 ? 0 : 26 + (index - 1) * 33;
    assert.equal((page.match(/material-description-cell/g) || []).length,
      Math.min(index === 0 ? 26 : 33, count - startIndex));
    if (count > 0) assert.ok(page.includes(`<td>${startIndex + 1}</td>`));
    assert.ok(page.includes(`Σελίδα ${index + 1} από ${pages.length}`));
    assert.equal(page.includes('composition-document-footer'), index === pages.length - 1);
    assert.equal(page.includes('ΚΑΤΑΣΤΑΣΗ ΣΥΝΘΕΣΕΩΣ'), index === 0);
  });
  }
}
console.log('ADDY composition pagination tests passed.');
