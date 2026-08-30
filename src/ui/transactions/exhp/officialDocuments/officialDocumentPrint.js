import { escapeHtml } from '../../../components/forms.js';
import { formatDate } from '../../shared.js';

export async function printExhpDocument(preview) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: false });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

export function previewExhpDocument(type, data) {
  const existing = document.querySelector('.exhp-document-preview-backdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop exhp-document-preview-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ ΕΧΠ</p>
          <h2>${escapeHtml(previewTitle(type))}</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-exhp-doc-preview type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-exhp-doc-preview type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="request-document-preview">
        ${type === 'ammo_consumption'
          ? renderFaithfulAmmoDocument(data)
          : `<article class="index-page print-document-area">
              <h1>${escapeHtml(previewTitle(type))}</h1>
              ${renderPreviewMeta(type, data)}
              ${renderPreviewItems(type, data)}
            </article>`}
      </div>
    </section>
  `;

  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-exhp-doc-preview]')) {
      modal.remove();
      return;
    }
    if (event.target.closest('[data-print-exhp-doc-preview]')) {
      await window.appApi.print.currentDocument({ landscape: false });
    }
  });

  document.body.appendChild(modal);
}

function previewTitle(type) {
  if (type === 'useless_material_a') return 'Πρωτόκολλο Πρωτοβάθμιας Επιτροπής';
  if (type === 'useless_material_b') return 'Πρωτόκολλο Δευτεροβάθμιας Επιτροπής';
  return 'Πιστοποιητικό Καταναλώσεως Πυρομαχικών (ΔΥΠ/192)';
}

function renderPreviewMeta(type, data) {
  const entries = type === 'useless_material_a'
    ? [
        ['Τόπος', data.location], ['Ημερομηνία', formatDate(data.date)],
        ['Αριθμός ΗΔΜ', data.hdmNumber], ['Πρόεδρος', data.president],
        ['Α΄Μέλος', data.memberA], ['Β΄Μέλος', data.memberB],
        ['Περίοδος από', formatDate(data.periodFrom)], ['Περίοδος έως', formatDate(data.periodTo)]
      ]
    : type === 'useless_material_b'
      ? [
          ['Πρόεδρος', data.president], ['Α΄Μέλος', data.memberA],
          ['Β΄Μέλος', data.memberB], ['Δκτής', data.commander],
          ['Γεν. Διαχειριστής', data.generalManager],
          ['Διαχειριστής Αχρήστου Υλικού', data.uselessManager]
        ]
      : [
          ['Βαθμός', data.officerRank], ['Ονοματεπώνυμο Αξκού Επόπτη', data.officerName],
          ['Μονάδα/Τμήμα', data.unit], ['Ημερομηνία Βολής', formatDate(data.firingDate)],
          ['Ημέρα Εβδομάδας', data.dayOfWeek], ['Αριθμός Αντιγράφων', data.copiesCount]
        ];

  return `
    <table class="index-table">
      <tbody>
        ${entries.map(([label, value]) => `
          <tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value ?? '')}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPreviewItems(type, data) {
  if (type === 'ammo_consumption') {
    return `
      ${renderAmmoPreviewTable('Πίνακας Α - Καταναλωθέντα', data.items.filter((item) => item.itemType === 'consumed'))}
      ${renderAmmoPreviewTable('Πίνακας Β - Κενά Συσκευασίας', data.items.filter((item) => item.itemType === 'empty'))}
    `;
  }

  const isPrimary = type === 'useless_material_a';
  return `
    <table class="index-table">
      <thead>
        <tr>
          <th>Α/Α</th><th>Αρ. Μερίδας</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th>
          ${isPrimary
            ? '<th>Ποσότητα</th><th>Τιμή Κτήσης</th><th>Ημ. Κτήσης</th><th>Παρατηρήσεις</th>'
            : '<th>Ποσότητα Πρωτοβάθμιας</th><th>Ποσότητα Δευτεροβάθμιας</th><th>Διαφορά (+)</th><th>Διαφορά (-)</th>'}
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.shareNumber || '')}</td>
            <td>${escapeHtml(item.nomenclatureNumber || '')}</td>
            <td>${escapeHtml(item.description || '')}</td>
            <td>${escapeHtml(item.unit || '')}</td>
            ${isPrimary
              ? `<td>${escapeHtml(item.quantity ?? '')}</td><td>${escapeHtml(item.acquisitionPrice || '')}</td><td>${escapeHtml(formatDate(item.acquisitionDate) || '')}</td><td>${escapeHtml(item.remarks || '')}</td>`
              : `<td>${escapeHtml(item.qtyPrimary ?? '')}</td><td>${escapeHtml(item.qtySecondary ?? '')}</td><td>${escapeHtml(item.diffPlus ?? '')}</td><td>${escapeHtml(item.diffMinus ?? '')}</td>`}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderFaithfulAmmoDocument(data = {}) {
  const consumedItems = (data.items || []).filter((item) => item.itemType === 'consumed');
  const emptyItems = (data.items || []).filter((item) => item.itemType === 'empty');
  const consumedPages = chunkRows(consumedItems.length ? consumedItems : [{}], 5);
  const emptyPages = chunkRows(emptyItems.length ? emptyItems : [{}], 5);
  const pageCount = Math.max(consumedPages.length, emptyPages.length, 1);
  const officer = [data.officerRank, data.officerName].filter(Boolean).join(' - ');
  return Array.from({ length: pageCount }, (_unused, pageIndex) => `
    <article class="official-overlay-page dyp192-page print-document-area" data-dyp192-preview-page="${pageIndex + 1}">
      <img src="./assets/official-forms/dyp192-clean.png" alt="ΔΥΠ/192 - Πιστοποιητικό Καταναλώσεως Πυρομαχικών" />
      ${officialPreviewOverlay(officer, 9.51, 8.13, 73.79, 3.69, 'dyp192-overlay dyp192-officer-overlay')}
      ${officialPreviewOverlay(data.unit, 9.51, 14.05, 36.28, 1.72, 'dyp192-overlay')}
      ${officialPreviewOverlay(formatDate(data.firingDate), 9.51, 19.98, 26.20, 1.72, 'dyp192-overlay')}
      ${officialPreviewOverlay(data.dayOfWeek, 56.24, 19.98, 26.74, 1.72, 'dyp192-overlay')}
      ${renderAmmoLineOverlays(consumedPages[pageIndex] || [], 33.03)}
      ${renderAmmoLineOverlays(emptyPages[pageIndex] || [], 59.15)}
      ${officialPreviewOverlay(data.copiesCount, 35.28, 81.27, 4.72, 1.57, 'dyp192-overlay')}
    </article>
  `).join('');
}

function renderAmmoLineOverlays(items, firstTop) {
  return Array.from({ length: 5 }, (_unused, rowIndex) => {
    const item = items[rowIndex] || {};
    return officialPreviewOverlay(formatAmmoLine(item), 23.80, firstTop + rowIndex * 3.695, 59.03, 1.72, 'dyp192-overlay dyp192-list-overlay');
  }).join('');
}

function officialPreviewOverlay(value, left, top, width, height, className = '') {
  return `<div class="official-overlay-field ${escapeHtml(className)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function formatAmmoLine(item = {}) {
  const description = item.description || '';
  const quantity = item.quantity ?? '';
  if (!description && (quantity === '' || quantity === null || quantity === undefined)) return '';
  if (quantity === '' || quantity === null || quantity === undefined) return description;
  return `${description} - ${quantity}`;
}

function chunkRows(items, size) {
  const source = Array.isArray(items) && items.length ? items : [{}];
  const chunks = [];
  for (let index = 0; index < source.length; index += size) chunks.push(source.slice(index, index + size));
  return chunks.length ? chunks : [[{}]];
}

function renderAmmoPreviewTable(title, items) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table class="index-table">
      <thead><tr><th>Περιγραφή</th><th>Ποσότητα</th></tr></thead>
      <tbody>
        ${items.map((item) => `
          <tr><td>${escapeHtml(item.description || '')}</td><td>${escapeHtml(item.quantity ?? '')}</td></tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
