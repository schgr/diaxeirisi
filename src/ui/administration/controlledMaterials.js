import { escapeHtml } from '../components/forms.js';
import { formatQuantity } from '../shares/shared.js';

const CONTROLLED_MATERIAL_CATEGORIES = [
  { id: 1, from: 0, to: 6499, label: 'Οπλισμός' },
  { id: 2, from: 6500, to: 9999, label: 'Όργανα Σκοπεύσεως - Παρατηρήσεως' },
  { id: 3, from: 10000, to: 19999, label: 'Υλικά Τηλεπικοινωνιών' },
  { id: 4, from: 20000, to: 29999, label: 'Μηχανήματα Μηχανικού' },
  { id: 5, from: 30000, to: 39999, label: 'Οχήματα' },
  { id: 6, from: 40000, to: 40999, label: 'Οχήματα Μάχης - Άρματα' },
  { id: 7, from: 41000, to: 41999, label: 'Αεροσκάφη - Ελικόπτερα' },
  { id: 8, from: 42000, to: 43999, label: 'Οχήματα - Μηχανήματα - Ρυμουλκούμενα' },
  { id: 9, from: 44000, to: 44999, label: 'Ταχύπλοα Σκάφη - Μεταφοράς Προσωπικού' },
  { id: 10, from: 45000, to: 45999, label: 'Οχήματα - Μηχανήματα Μάχης μη Μάχης' },
  { id: 11, from: 46000, to: 46999, label: 'Μηχανήματα - Οχήματα - Αεροσκάφη (Εξ επιτάξεως)' },
  { id: 12, from: 50000, to: 59999, label: 'Οπτικά - Υλικά ΡΒΧΠ - Ερευνητές Ναρκών' }
];

export function renderControlledMaterialsBook(cards) {
  const rows = controlledMaterialRows(cards);
  return `
    <section class="controlled-materials-panel">
      <div class="page-header controlled-materials-header">
        <div>
          <h2>Βιβλίο Ελεγχομένων Υλικών</h2>
          <p class="muted">Τα υπάρχοντα προκύπτουν από το τρέχον υπόλοιπο της καρτέλας και τα προβλεπόμενα από το αντίστοιχο πεδίο της μερίδας.</p>
        </div>
      </div>
      <div class="transaction-flow-home contextual-tile-menu controlled-material-tabs no-print" data-controlled-material-menu>
        <button class="home-tile transaction-flow-tile" data-controlled-material-tab="materials" type="button"><span class="home-tile-icon">ΕΥ</span><span class="home-tile-title">Ελεγχόμενα Υλικά</span><span class="home-tile-code">§ ΕΥ-1</span></button>
        <button class="home-tile transaction-flow-tile" data-controlled-material-tab="settings" type="button"><span class="home-tile-icon">ΡΥ</span><span class="home-tile-title">Ρυθμίσεις</span><span class="home-tile-code">§ ΕΥ-2</span></button>
      </div>
      <div data-controlled-material-panel="materials" hidden>
        <div class="row-actions controlled-material-actions no-print">
          <label class="field controlled-material-print-category"><span>Διάταξη κατηγοριών</span><select data-controlled-material-print-category><option value="continuous">Όλες οι κατηγορίες συνεχόμενα</option><option value="by-category">Ανά κατηγορία ανά σελίδα</option></select></label>
          <button class="secondary-button" data-preview-controlled-materials type="button">Προβολή</button>
        </div>
        <div class="table-wrap controlled-materials-wrap">
          <table class="index-table controlled-materials-table" data-controlled-materials-table>
            <thead><tr><th>Α/Α</th><th>Αριθμός Μερίδας</th><th>Κώδικας<br />Υλικού</th><th>Περιγραφή</th><th>Προβλεπόμενα</th><th>Υπάρχοντα</th><th>Πλεόνασμα</th><th>Έλλειμμα</th><th>Παρατηρήσεις</th></tr></thead>
            <tbody>${rows.length ? rows.map(renderControlledMaterialRow).join('') : '<tr><td colspan="9" class="empty-table">Δεν υπάρχουν μερίδες που αντιστοιχούν στις κατηγορίες ελεγχομένων υλικών.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div data-controlled-material-panel="settings" hidden>
        ${renderControlledMaterialSettings()}
      </div>
    </section>
  `;
}

export function renderWeaponRegistry(items) {
  const sorted = [...items].sort((a, b) => Number(a.share.mainMaterialNumber) - Number(b.share.mainMaterialNumber));
  return `
    <section class="page-panel wide-panel weapon-registry-panel">
      <div class="requests-status-header">
        <div><h3>Μητρώο Οπλισμού</h3><p class="muted">Εμφανίζονται οι μερίδες στις οποίες είναι ενεργό το πεδίο «Μητρώο Οπλισμού».</p></div>
      </div>
      ${sorted.length ? `<div class="weapon-registry-selector no-print"><label class="field"><span>Είδος Οπλισμού</span><select data-weapon-registry-select>${sorted.map((item) => `<option value="${item.share.id}">ΚΑ ${escapeHtml(item.share.mainMaterialNumber)} · ${escapeHtml(item.share.description)}</option>`).join('')}</select></label><div class="row-actions"><button class="secondary-button" data-add-selected-weapon-row type="button">Προσθήκη εγγραφής</button><button class="secondary-button" data-preview-selected-weapon type="button">Προβολή</button><button class="secondary-button" data-preview-all-weapons type="button">Προβολή όλου του Μητρώου</button><button class="primary-button" data-save-selected-weapon type="button">Αποθήκευση</button></div></div><div class="weapon-registry-books">${sorted.map((item, index) => renderWeaponRegistryEditor(item, index)).join('')}</div>` : '<p class="empty-table">Δεν υπάρχουν μερίδες με ενεργό Μητρώο Οπλισμού.</p>'}
    </section>
  `;
}

export function bindControlledMaterialEvents(container, showToast, sharesApi = window.appApi.shares) {
  container.querySelectorAll('[data-controlled-material-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.controlledMaterialTab;
      container.querySelectorAll('[data-controlled-material-tab]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
      container.querySelectorAll('[data-controlled-material-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.controlledMaterialPanel !== tab;
      });
      container.querySelector('[data-controlled-material-menu]').hidden = true;
    });
  });
  container.querySelector('[data-preview-controlled-materials]')?.addEventListener('click', () => openControlledMaterialsPreview(container, showToast));
  const selectedWeaponBook = () => container.querySelector(`[data-weapon-registry-book][data-share-id="${container.querySelector('[data-weapon-registry-select]')?.value}"]`);
  container.querySelector('[data-weapon-registry-select]')?.addEventListener('change', () => {
    const selectedId = container.querySelector('[data-weapon-registry-select]').value;
    container.querySelectorAll('[data-weapon-registry-book]').forEach((book) => { book.hidden = book.dataset.shareId !== selectedId; });
  });
  container.querySelector('[data-add-selected-weapon-row]')?.addEventListener('click', () => {
    const book = selectedWeaponBook();
    const body = book.querySelector('tbody');
    const balance = Number(book.dataset.accountingBalance || 0);
    if (body.querySelectorAll('[data-weapon-registry-entry]').length >= balance) {
      showToast(`Οι εγγραφές του Μητρώου Οπλισμού δεν μπορούν να υπερβαίνουν το υπόλοιπο της μερίδας (${formatQuantity(balance)}).`, 'error');
      return;
    }
    body.insertAdjacentHTML('beforeend', renderWeaponRegistryEntry({}, body.querySelectorAll('[data-weapon-registry-entry]').length));
  });
  container.querySelector('[data-save-selected-weapon]')?.addEventListener('click', async () => {
    const book = selectedWeaponBook();
    try {
      const entries = sortedWeaponRegistryEntries(collectWeaponRegistryEntries(book));
      const result = await sharesApi.saveWeaponRegistry(Number(book.dataset.shareId), entries);
      renderWeaponRegistryBody(book, entries);
      showToast(result.message);
    } catch (error) { showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του Μητρώου Οπλισμού.', 'error'); }
  });
  container.querySelector('[data-preview-selected-weapon]')?.addEventListener('click', () => openWeaponRegistryPreview(selectedWeaponBook(), showToast));
  container.querySelector('[data-preview-all-weapons]')?.addEventListener('click', () => {
    const pages = [...container.querySelectorAll('[data-weapon-registry-book]')].flatMap(buildWeaponRegistryPages);
    openWeaponRegistryPages(numberWeaponRegistryPages(pages), showToast);
  });
  container.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-weapon-entry]');
    if (!deleteButton) return;
    const row = deleteButton.closest('[data-weapon-registry-entry]');
    const book = row.closest('[data-weapon-registry-book]');
    row.nextElementSibling?.remove();
    row.remove();
    renumberWeaponRegistryRows(book);
  });
  container.addEventListener('change', (event) => {
    if (!event.target.matches('[name="registryNumber"]')) return;
    const book = event.target.closest('[data-weapon-registry-book]');
    renderWeaponRegistryBody(book, sortedWeaponRegistryEntries(collectWeaponRegistryEntries(book)));
  });
}

function renderWeaponRegistryEditor(item, index) {
  const entries = sortedWeaponRegistryEntries(item.entries);
  return `
    <article class="weapon-registry-book" data-weapon-registry-book data-share-id="${item.share.id}" data-accounting-balance="${Number(item.share.accountingBalance || 0)}" ${index ? 'hidden' : ''}>
      <div class="weapon-registry-title-row">
        <div><strong>Είδος Οπλισμού:</strong> ${escapeHtml(item.share.description)} · <strong>Αριθμός Ονομαστικού:</strong> ${escapeHtml(item.share.nominalNumber)} · <strong>ΚΑ:</strong> ${escapeHtml(item.share.mainMaterialNumber)}</div>
      </div>
      <div class="table-wrap"><table class="weapon-registry-form-table">${weaponRegistryHead()}<tbody>${entries.map(renderWeaponRegistryEntry).join('')}</tbody></table></div>
    </article>`;
}

function weaponRegistryHead() {
  return `<thead><tr><th rowspan="2">Α/Α</th><th>Στοιχεία</th><th>Μονάδα από την οποία Περιήλθε</th><th>Σε ποιο Τμήμα της Μονάδας Βρίσκεται</th><th>Παραδ. (εκτός της Μονάδας)</th><th rowspan="2">Μεταβολές, Παρατηρήσεις κ.λπ.</th></tr><tr><th>Αριθ. Μητρώου</th><th>Χρονολογία Εισόδου</th><th>Από (Ημερομηνία)</th><th>Την (Ημερομηνία)</th></tr></thead>`;
}

function renderWeaponRegistryEntry(entry, index) {
  return `<tr data-weapon-registry-entry><td rowspan="2" class="weapon-registry-index"><span data-weapon-entry-number>${index + 1}</span><button class="danger-button no-print weapon-entry-delete" data-delete-weapon-entry type="button">Διαγραφή</button></td><td><input name="details" value="${escapeHtml(entry.details || '')}" aria-label="Στοιχεία" /></td><td><input name="sourceUnit" value="${escapeHtml(entry.sourceUnit || '')}" aria-label="Μονάδα προελεύσεως" /></td><td><input name="currentDepartment" value="${escapeHtml(entry.currentDepartment || '')}" aria-label="Τμήμα Μονάδας" /></td><td><input name="deliveredOutsideUnit" value="${escapeHtml(entry.deliveredOutsideUnit || '')}" aria-label="Παραδόθηκε εκτός Μονάδας" /></td><td rowspan="2"><textarea name="notes" aria-label="Μεταβολές και Παρατηρήσεις">${escapeHtml(entry.notes || '')}</textarea></td></tr><tr data-weapon-registry-entry-detail><td><input name="registryNumber" value="${escapeHtml(entry.registryNumber || '')}" aria-label="Αριθμός Μητρώου" /></td><td><input name="entryYear" value="${escapeHtml(entry.entryYear || '')}" aria-label="Χρονολογία Εισόδου" /></td><td><input name="fromDate" type="date" value="${escapeHtml(entry.fromDate || '')}" aria-label="Από ημερομηνία" /></td><td><input name="deliveredDate" type="date" value="${escapeHtml(entry.deliveredDate || '')}" aria-label="Την ημερομηνία" /></td></tr>`;
}

function sortedWeaponRegistryEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftNumber = String(left.registryNumber || '').trim();
    const rightNumber = String(right.registryNumber || '').trim();
    if (!leftNumber) return rightNumber ? 1 : 0;
    if (!rightNumber) return -1;
    return leftNumber.localeCompare(rightNumber, 'el', { numeric: true, sensitivity: 'base' });
  });
}

function renderWeaponRegistryBody(book, entries) {
  book.querySelector('tbody').innerHTML = entries.map(renderWeaponRegistryEntry).join('');
}

function renumberWeaponRegistryRows(book) {
  book.querySelectorAll('[data-weapon-entry-number]').forEach((number, index) => { number.textContent = index + 1; });
}

function collectWeaponRegistryEntries(book) {
  return [...book.querySelectorAll('[data-weapon-registry-entry]')].map((row) => {
    const detail = row.nextElementSibling;
    const value = (scope, name) => scope.querySelector(`[name="${name}"]`)?.value || '';
    return { details: value(row, 'details'), registryNumber: value(detail, 'registryNumber'), sourceUnit: value(row, 'sourceUnit'), entryYear: value(detail, 'entryYear'), currentDepartment: value(row, 'currentDepartment'), fromDate: value(detail, 'fromDate'), deliveredOutsideUnit: value(row, 'deliveredOutsideUnit'), deliveredDate: value(detail, 'deliveredDate'), notes: value(row, 'notes') };
  });
}

function openWeaponRegistryPreview(book, showToast) {
  openWeaponRegistryPages(numberWeaponRegistryPages(buildWeaponRegistryPages(book)), showToast);
}

function openWeaponRegistryPages(pages, showToast) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop request-document-backdrop controlled-material-preview-backdrop';
  modal.innerHTML = `<section class="request-document-modal"><header class="material-card-header no-print"><h2>Μητρώο Οπλισμού</h2><div class="row-actions"><button class="primary-button" data-print-weapon-preview data-export-title="Μητρώο Οπλισμού" data-export-orientation="portrait" type="button">Εκτύπωση</button><button class="secondary-button" data-close-controlled-preview type="button">Κλείσιμο</button></div></header><div class="request-document-preview weapon-registry-document-preview">${pages.join('')}</div></section>`;
  modal.querySelector('[data-close-controlled-preview]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-print-weapon-preview]').addEventListener('click', () => printWeaponRegistryPages(pages, showToast));
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function buildWeaponRegistryPages(book) {
  const entries = sortedWeaponRegistryEntries(collectWeaponRegistryEntries(book));
  const title = book.querySelector('.weapon-registry-title-row > div')?.innerHTML || '';
  const rowsPerPage = 10;
  const pageCount = Math.max(1, Math.ceil(entries.length / rowsPerPage));
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const rows = entries.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    while (rows.length < rowsPerPage) rows.push(null);
    return `<article class="weapon-registry-print print-document-area"><div class="weapon-registry-print-heading">${title}</div><table class="weapon-registry-form-table">${weaponRegistryHead()}<tbody>${rows.map((entry, index) => renderWeaponRegistryPrintEntry(entry, pageIndex * rowsPerPage + index)).join('')}</tbody></table><footer></footer></article>`;
  });
}

function numberWeaponRegistryPages(pages) {
  return pages.map((page, index) => page.replace('<footer></footer>', `<footer>Σελίδα ${index + 1} από ${pages.length}</footer>`));
}

function renderWeaponRegistryPrintEntry(entry, index) {
  const cell = (value) => `<span>${escapeHtml(value || '')}</span>`;
  return `<tr><td rowspan="2" class="weapon-registry-index">${entry ? index + 1 : ''}</td><td>${cell(entry?.details)}</td><td>${cell(entry?.sourceUnit)}</td><td>${cell(entry?.currentDepartment)}</td><td>${cell(entry?.deliveredOutsideUnit)}</td><td rowspan="2">${cell(entry?.notes)}</td></tr><tr><td>${cell(entry?.registryNumber)}</td><td>${cell(entry?.entryYear)}</td><td>${cell(entry?.fromDate)}</td><td>${cell(entry?.deliveredDate)}</td></tr>`;
}

async function printWeaponRegistryPages(pages, showToast) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = pages.join('');
  document.body.appendChild(printRoot);
  document.body.dataset.isolatedDocumentPrint = 'true';
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await window.appApi.print.currentDocument({ landscape: false });
  } catch (error) {
    showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του Μητρώου Οπλισμού.', 'error');
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function controlledMaterialRows(cards) {
  return cards.map((card) => {
    const category = categoryForCode(card.share?.mainMaterialNumber);
    if (!category) return null;
    const projected = Number(card.share.projectedQuantity || 0);
    const existing = Number(card.share.accountingBalance || 0);
    return {
      share: card.share,
      category,
      projected,
      existing,
      surplus: Math.max(existing - projected, 0),
      deficit: Math.max(projected - existing, 0)
    };
  }).filter(Boolean).sort((a, b) => Number(a.share.mainMaterialNumber) - Number(b.share.mainMaterialNumber));
}

function renderControlledMaterialRow(item, index) {
  return `
    <tr data-controlled-category="${item.category.id}">
      <td>${index + 1}</td>
      <td>${escapeHtml(item.share.shareNumber)}</td>
      <td>${escapeHtml(item.share.mainMaterialNumber)}</td>
      <td class="material-description-cell">${escapeHtml(item.share.description)}</td>
      <td>${formatQuantity(item.projected)}</td>
      <td>${formatQuantity(item.existing)}</td>
      <td>${formatQuantity(item.surplus)}</td>
      <td>${formatQuantity(item.deficit)}</td>
      <td></td>
    </tr>
  `;
}

function renderControlledMaterialSettings() {
  return `
    <div class="table-wrap controlled-material-settings-wrap">
      <table class="index-table controlled-material-settings-table">
        <thead><tr><th>Α/Α</th><th>Εύρος Αριθμού Κώδικα</th><th>Ομάδα Ελεγχομένων</th></tr></thead>
        <tbody>${CONTROLLED_MATERIAL_CATEGORIES.map((category) => `
          <tr><td>${category.id}</td><td>${padCode(category.from)} - ${padCode(category.to)}</td><td>${escapeHtml(category.label)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function categoryForCode(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const code = Number(digits);
  return CONTROLLED_MATERIAL_CATEGORIES.find((category) => code >= category.from && code <= category.to) || null;
}

function padCode(value) {
  return String(value).padStart(5, '0');
}

function bindTableActions(container, previewSelector, printSelector, tableSelector, title, showToast) {
  container.querySelector(previewSelector)?.addEventListener('click', () => openTablePreview(container.querySelector(tableSelector), title, showToast));
  container.querySelector(printSelector)?.addEventListener('click', () => printTable(container.querySelector(tableSelector), title, showToast));
}

function buildControlledMaterialPages(container) {
  const layout = container.querySelector('[data-controlled-material-print-category]')?.value || 'continuous';
  const table = container.querySelector('[data-controlled-materials-table]');
  if (!table) return [];
  const groups = CONTROLLED_MATERIAL_CATEGORIES.map((category) => ({
    category,
    rows: [...table.querySelectorAll(`tbody tr[data-controlled-category="${category.id}"]`)]
  })).filter((group) => group.rows.length);
  const pageGroups = layout === 'by-category'
    ? buildCategoryPageGroups(groups)
    : buildContinuousPageGroups(groups);
  return pageGroups.map(({ sections }, index) => `
    <article class="controlled-material-print print-document-area">
      <table class="index-table controlled-materials-table">
        ${table.querySelector('thead').outerHTML}
        <tbody>${sections.map(({ category, rows }) => `
          <tr class="controlled-material-category-heading"><th colspan="9">${escapeHtml(category.label)}</th></tr>
          ${rows.map((row) => row.outerHTML).join('')}
        `).join('')}</tbody>
      </table>
      <footer>Σελίδα ${index + 1} από ${pageGroups.length}</footer>
    </article>
  `);
}

function buildCategoryPageGroups(groups) {
  const pages = [];
  groups.forEach(({ category, rows }) => {
    for (let offset = 0; offset < rows.length; offset += 18) {
      pages.push({ sections: [{ category, rows: rows.slice(offset, offset + 18) }] });
    }
  });
  return pages;
}

function buildContinuousPageGroups(groups) {
  const pages = [];
  let sections = [];
  let remaining = 18;
  groups.forEach(({ category, rows }) => {
    let offset = 0;
    while (offset < rows.length) {
      if (!remaining) {
        pages.push({ sections });
        sections = [];
        remaining = 18;
      }
      const pageRows = rows.slice(offset, offset + remaining);
      sections.push({ category, rows: pageRows });
      offset += pageRows.length;
      remaining -= pageRows.length;
    }
  });
  if (sections.length) pages.push({ sections });
  return pages;
}

function openControlledMaterialsPreview(container, showToast) {
  const pages = buildControlledMaterialPages(container);
  if (!pages.length) {
    showToast('Δεν υπάρχουν ελεγχόμενα υλικά για εκτύπωση.', 'error');
    return;
  }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop request-document-backdrop controlled-material-preview-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal">
      <header class="material-card-header no-print"><h2>Βιβλίο Ελεγχομένων Υλικών</h2><div class="row-actions"><button class="secondary-button" data-close-controlled-preview type="button">Κλείσιμο</button><button class="primary-button" data-print-controlled-preview type="button">Εκτύπωση</button></div></header>
      <div class="request-document-preview controlled-material-document-preview">${pages.join('')}</div>
    </section>`;
  modal.querySelector('[data-close-controlled-preview]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-print-controlled-preview]').addEventListener('click', () => printControlledMaterialPages(pages, showToast));
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function printControlledMaterials(container, showToast) {
  const pages = buildControlledMaterialPages(container);
  if (!pages.length) {
    showToast('Δεν υπάρχουν ελεγχόμενα υλικά για εκτύπωση.', 'error');
    return;
  }
  return printControlledMaterialPages(pages, showToast);
}

async function printControlledMaterialPages(pages, showToast) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = pages.join('');
  document.body.appendChild(printRoot);
  document.body.dataset.isolatedDocumentPrint = 'true';
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await window.appApi.print.currentDocument({ landscape: true });
  } catch (error) {
    showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του Βιβλίου Ελεγχομένων Υλικών.', 'error');
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function openTablePreview(table, title, showToast) {
  if (!table) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop request-document-backdrop controlled-material-preview-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal">
      <header class="material-card-header no-print"><h2>${escapeHtml(title)}</h2><div class="row-actions"><button class="secondary-button" data-close-controlled-preview type="button">Κλείσιμο</button><button class="primary-button" data-print-controlled-preview type="button">Εκτύπωση</button></div></header>
      <div class="request-document-preview"><article class="controlled-material-print print-document-area"><h2>${escapeHtml(title)}</h2>${table.outerHTML}</article></div>
    </section>`;
  modal.querySelector('[data-close-controlled-preview]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-print-controlled-preview]').addEventListener('click', () => printTable(modal.querySelector('table'), title, showToast));
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function printTable(table, title, showToast, landscape = true) {
  if (!table) return;
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = `<section class="controlled-material-print print-document-area"><h2>${escapeHtml(title)}</h2>${table.outerHTML}</section>`;
  document.body.appendChild(printRoot);
  document.body.dataset.isolatedDocumentPrint = 'true';
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await window.appApi.print.currentDocument({ landscape });
  } catch (error) {
    showToast(error.message || `Δεν ήταν δυνατή η εκτύπωση: ${title}.`, 'error');
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

export { CONTROLLED_MATERIAL_CATEGORIES, categoryForCode, controlledMaterialRows, buildControlledMaterialPages, buildCategoryPageGroups, buildContinuousPageGroups };
