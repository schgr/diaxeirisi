
async function printIsolatedPreview(preview, landscape) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);

  // Add landscape CSS to head for better print support
  let styleElement = null;
  if (landscape) {
    styleElement = document.createElement('style');
    styleElement.id = 'temp-print-landscape-style';
    styleElement.textContent = '@media print { @page { size: A4 landscape; margin: 0; } }';
    document.head.appendChild(styleElement);
  }

  try {
    await window.appApi.print.currentDocument({ landscape });
  } finally {
    if (styleElement) {
      styleElement.remove();
    }
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

// Scale the complete paper, rather than reflowing its fixed-size contents.
const portraitPages = '.faithful-form-page, .official-share-page, .official-inventory-page, .official-a4-form, .official-movement-protocol-page, .official-handover-page, .share-document-page, .weapon-registry-print, .dyp192-page, .material-registry-page, .addy-composition-document, .composition-document-page';
const landscapePages = '.request-document-page, .addy-document-page, .faithful-form-page-landscape, .exhp-faithful-page, .exhp-clean-page, .official-index-page, .external-excel-index-page, .index-page, .serial-registry-print-page, .financial-year-print-sheet, .balance-differences-page, .controlled-material-print, .change-sheet-document-page, .ammunition-batch-preview-page, .ammunition-batch-print';
const previewContainers = '.request-document-preview, .handover-document-preview, .index-document-preview-content, .inventory-modal-preview, .category-share-preview-content';

function calculatePreviewScale(width, height, paperWidth, paperHeight, mode = 'page') {
  if (mode === 'actual') return 1;
  const widthScale = Math.max(1, width) / paperWidth;
  return Math.min(1, widthScale, mode === 'width' ? Infinity : Math.max(1, height) / paperHeight);
}

function initializeDocumentPreviews() {
  const viewers = new Map();
  let frame = 0;
  const update = () => {
    frame = 0;
    for (const [preview, viewer] of viewers) {
      if (!preview.isConnected) {
        viewer.observer.disconnect();
        viewer.toolbar.remove();
        viewers.delete(preview);
        continue;
      }
      const pages = [...preview.querySelectorAll(`${portraitPages}, ${landscapePages}`)]
        .filter((page) => !page.parentElement.closest(`${portraitPages}, ${landscapePages}`));
      const style = getComputedStyle(preview);
      const width = preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
      const height = preview.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2;
      pages.forEach((page) => {
        page.dataset.previewPaper = page.matches(landscapePages) ? 'landscape' : 'portrait';
        const scale = calculatePreviewScale(width, height, page.offsetWidth, page.offsetHeight, viewer.mode);
        page.style.setProperty('--preview-scale', String(scale));
      });
      const label = pages.length ? `${Math.round(Number(pages[0].style.getPropertyValue('--preview-scale')) * 100)}%` : '';
      if (viewer.output.textContent !== label) viewer.output.textContent = label;
    }
  };
  const schedule = () => {
    if (!frame) frame = window.setTimeout(update, 16);
  };
  const discover = () => {
    document.querySelectorAll(previewContainers).forEach((preview) => {
      if (viewers.has(preview) || preview.closest('.isolated-print-root')) return;
      const modal = preview.closest('.request-document-modal, .handover-document-modal, .inventory-statement-modal, .category-share-preview-modal');
      if (!modal || !preview.querySelector(`${portraitPages}, ${landscapePages}`)) return;
      modal.classList.add('document-preview-modal');
      preview.classList.add('document-preview-viewport');
      const toolbar = document.createElement('div');
      toolbar.className = 'document-preview-tools no-print';
      toolbar.dataset.noDocumentExport = '';
      toolbar.innerHTML = '<label>Προβολή <select aria-label="Μέγεθος προεπισκόπησης"><option value="page">Προσαρμογή σελίδας</option><option value="width">Προσαρμογή πλάτους</option><option value="actual">100%</option></select></label><output aria-live="polite"></output>';
      preview.before(toolbar);
      const observer = new ResizeObserver(schedule);
      observer.observe(preview);
      const viewer = { toolbar, observer, mode: 'page', output: toolbar.querySelector('output') };
      viewers.set(preview, viewer);
      toolbar.querySelector('select').addEventListener('change', (event) => {
        viewer.mode = event.target.value;
        preview.scrollTop = 0;
        preview.scrollLeft = 0;
        schedule();
      });
    });
    schedule();
  };
  new MutationObserver(discover).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  document.fonts.ready.then(schedule);
  discover();
}

export { initializeDocumentPreviews, printIsolatedPreview };
