
async function printIsolatedPreview(preview, landscape) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

export { printIsolatedPreview };
