import { escapeHtml } from '../../ui/components/forms.js';
import { formatDate, formatQuantity, greekMonthNumber } from '../../ui/transactions/shared.js';

export function renderOfficialSupportForm(documentData, support, formData, code) {
  if (code === 'ΕΦΕΔ 505') return renderEfed505(documentData, formData);
  if (code === 'ΕΦΕΔ 506') return renderEfed506(documentData, formData);
  if (code === 'ΔΥΠ/190') return renderDyp190(documentData, formData);
  if (code === 'ΔΥΠ/191') return renderDyp191(documentData, formData);
  if (code === 'ΔΥΠ/192') return renderDyp192(documentData, formData);
  if (code === 'ΕΦΕΔ 410') return renderEfed410(documentData, formData);
  if (code.includes('ΔΥΠ/9-10-11')) return renderClothingStatement(documentData, formData);
  if (code.includes('ΔΥΠ/8')) return renderIndividualClothingSheet(documentData, formData);
  if (String(support.title || '').toLocaleLowerCase('el-GR').includes('επιτροπής επιθεώρησης')) {
    return renderUselessMaterialProtocol(documentData, formData);
  }
  return '';
}

export function renderFaithfulOfficialForm(documentData, support, formData, definition) {
  if (definition.renderer === 'efed506') return renderFaithfulEfed506(documentData, formData);
  if (definition.renderer === 'dyp192') return renderFaithfulDyp192Support(documentData, formData);
  return `
    <section class="faithful-form-editor">
      ${definition.pages.map((page, pageIndex) => `
        <div class="faithful-form-page support-clean-page print-document-area${page.orientation === 'landscape' ? ' faithful-form-page-landscape' : ''}">
          <img src="./assets/official-forms/${page.image}" alt="${escapeHtml(support.title)} - σελίδα ${pageIndex + 1}" />
          <div class="support-clean-mask support-page-number-mask"></div>
          <div class="support-clean-mask support-sample-mask"></div>
          <div class="support-clean-mask support-footer-mask"></div>
          ${page.fields.map((field) => faithfulOverlayField(field, formData, documentData)).join('')}
          ${page.table ? faithfulTableOverlay(page.table, pageIndex, formData, documentData) : ''}
        </div>
      `).join('')}
    </section>
  `;
}

export function renderGenericSupportPreview(documentData, support, formData) {
  return `
    <article class="index-page inventory-print-page print-document-area support-template-page">
      <div class="print-document-code">${escapeHtml(support.documentCode || '')}</div>
      <h1>${escapeHtml(support.title).toUpperCase()}</h1>
      <section class="support-form-fields">${Object.entries(formData).filter(([name]) => name !== 'materialItems').map(([name, value]) => `<p><strong>${escapeHtml(supportFieldLabel(name))}:</strong> ${escapeHtml(value)}</p>`).join('')}</section>
      ${renderOfficialItemsTable(documentData.items, Math.max(1, documentData.items.length))}
      <div class="handover-signatures"><div><span>Ο Συντάξας</span></div><div><span>Η Επιτροπή / Ο Θεωρών</span></div></div>
    </article>
  `;
}

function faithfulTableOverlay(table, pageIndex, formData, documentData) {
  const source = table.source === 'composition'
    ? ((documentData.materialAttachments && documentData.materialAttachments.composition) || [])
    : table.source === 'changes'
      ? ((documentData.materialAttachments && documentData.materialAttachments.changes) || [])
      : documentData.items;
  const items = source.slice(table.offset || 0, (table.offset || 0) + table.rows);
  return Array.from({ length: table.rows }, (_unused, rowIndex) => {
    const item = items[rowIndex] || {};
    const itemIndex = (table.offset || 0) + rowIndex;
    return table.columns.map((column) => {
      const name = `table_${pageIndex}_${rowIndex}_${column.key}`;
      const defaultValue = column.value ? column.value(item, rowIndex) : item[column.key];
      const value = formData[name] ?? defaultValue ?? '';
      const style = `left:${column.x}%;top:${table.y + rowIndex * table.step}%;width:${column.w}%;height:${table.height || table.step}%`;
      const descriptionClass = ['description', 'componentDescription', 'changeReason'].includes(column.key)
        ? ' material-description-overlay'
        : '';
      return `<div class="faithful-overlay-field faithful-table-field${descriptionClass}" style="${style}">${escapeHtml(value)}</div>`;
    }).join('');
  }).join('');
}

function faithfulOverlayField(field, formData, documentData) {
  const value = getSupportFieldValue(field.name, formData, documentData);
  const style = `left:${field.x}%;top:${field.y}%;width:${field.w}%;height:${field.h || 3.2}%`;
  const descriptionClass = /description/i.test(field.name) ? ' material-description-overlay' : '';
  return `<div class="faithful-overlay-field${descriptionClass}" style="${style}" data-support-preview-field="${field.name}">${escapeHtml(value)}</div>`;
}

function officialOverlayField(value, left, top, width, height, className = '') {
  return `<div class="official-overlay-field ${escapeHtml(className)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function renderFaithfulEfed506(documentData, formData) {
  const usedItems = splitEfed506Items(documentData.items, 'used');
  const producedItems = splitEfed506Items(documentData.items, 'produced');
  const pageCount = Math.max(1, Math.ceil(usedItems.length / 8), Math.ceil(producedItems.length / 10));
  const officers = documentData.financialOfficers || {};
  return `
    <section class="faithful-form-editor">
      ${Array.from({ length: pageCount }, (_unused, pageIndex) => {
        const usedPage = usedItems.slice(pageIndex * 8, pageIndex * 8 + 8);
        const producedPage = producedItems.slice(pageIndex * 10, pageIndex * 10 + 10);
        return `
          <article class="official-overlay-page efed506-page print-document-area" data-efed506-page="${pageIndex + 1}">
            <img src="./assets/official-forms/efed-506-clean.png" alt="ΕΦΕΔ 506 - Πρωτόκολλο Μετασχηματισμού Υλικών" />
            ${officialOverlayField(formData.unit || documentData.unit, 15.96, 7.04, 8.62, 1.30)}
            ${officialOverlayField(formData.exhpSerial || documentData.registryNumber, 63.69, 7.04, 7.73, 1.30)}
            ${officialOverlayField(formData.place || documentData.serviceLocation, 10.89, 14.52, 17.29, 1.30)}
            ${officialOverlayField(formData.day, 38.02, 14.52, 7.09, 1.30)}
            ${officialOverlayField(formData.month, 8.84, 17.86, 13.02, 1.30)}
            ${officialOverlayField(shortYear(formData.year || documentData.date), 28.23, 17.86, 2.35, 1.30)}
            ${officialOverlayField(formData.committeeOrder || formData.hdmNumber, 8.84, 19.49, 33.94, 1.30)}
            ${officialOverlayField(formData.chairman || formData.president, 8.84, 22.82, 32.63, 1.30)}
            ${officialOverlayField(formData.member1 || formData.memberB, 8.84, 26.16, 31.03, 1.30)}
            ${officialOverlayField(formData.member2 || formData.memberC, 8.84, 29.51, 33.20, 1.29)}
            ${renderEfed506Rows(usedPage, 48.42, 1.465, 8)}
            ${renderEfed506Rows(producedPage, 61.77, 1.463, 10)}
            ${officialOverlayField(officers.commander, 6.50, 93.30, 18.00, 1.35, 'efed506-signature-name')}
            ${officialOverlayField(officers.manager, 29.00, 93.40, 20.50, 1.35, 'efed506-signature-name')}
            ${officialOverlayField(formData.chairman || formData.president, 46.00, 97.80, 17.50, 1.25, 'efed506-signature-name')}
            ${officialOverlayField(formData.member1 || formData.memberB, 70.00, 97.80, 17.50, 1.25, 'efed506-signature-name')}
            ${officialOverlayField(formData.member2 || formData.memberC, 70.00, 100.50, 17.50, 1.25, 'efed506-signature-name')}
          </article>
        `;
      }).join('')}
    </section>
  `;
}

function renderFaithfulDyp192Support(documentData, formData) {
  const consumedItems = normalizeDyp192SupportItems(documentData.items, 'consumed');
  const emptyItems = normalizeDyp192SupportItems(documentData.items, 'empty');
  const pageCount = Math.max(1, Math.ceil(consumedItems.length / 5), Math.ceil(emptyItems.length / 5));
  return `
    <section class="faithful-form-editor">
      ${Array.from({ length: pageCount }, (_unused, pageIndex) => `
        <article class="official-overlay-page dyp192-page print-document-area" data-dyp192-page="${pageIndex + 1}">
          <img src="./assets/official-forms/dyp192-clean.png" alt="ΔΥΠ/192 - Πιστοποιητικό Καταναλώσεως Πυρομαχικών" />
          ${officialOverlayField(formData.supervisor, 9.51, 8.13, 73.79, 3.69, 'dyp192-overlay dyp192-officer-overlay')}
          ${officialOverlayField(formData.unit || documentData.unit, 9.51, 14.05, 36.28, 1.72, 'dyp192-overlay')}
          ${officialOverlayField(formData.exerciseDate, 9.51, 19.98, 26.20, 1.72, 'dyp192-overlay')}
          ${officialOverlayField(formData.weekday, 56.24, 19.98, 26.74, 1.72, 'dyp192-overlay')}
          ${renderDyp192SupportRows(consumedItems.slice(pageIndex * 5, pageIndex * 5 + 5), 33.03)}
          ${renderDyp192SupportRows(emptyItems.slice(pageIndex * 5, pageIndex * 5 + 5), 59.15)}
          ${officialOverlayField(formData.copies, 35.28, 81.27, 4.72, 1.57, 'dyp192-overlay')}
        </article>
      `).join('')}
    </section>
  `;
}

function renderEfed506Rows(items, firstTop, step, rowCount) {
  const columns = [
    { key: 'serial', left: 8.64, width: 4.55, value: (_item, index) => index + 1 },
    { key: 'nomenclatureNumber', left: 13.19, width: 14.50 },
    { key: 'description', left: 27.69, width: 20.97, className: 'efed506-item-description' },
    { key: 'measurementUnit', left: 48.66, width: 9.36 },
    { key: 'quantity', left: 58.01, width: 10.84, value: (item) => formatQuantity(item.quantity) },
    { key: 'supportingDocuments', left: 68.85, width: 12.62 }
  ];
  return Array.from({ length: rowCount }, (_unused, rowIndex) => {
    const item = items[rowIndex] || {};
    return columns.map((column) => {
      const value = column.value ? column.value(item, rowIndex) : getEfed506ItemValue(item, column.key);
      const className = ['efed506-row-overlay', column.className || ''].filter(Boolean).join(' ');
      return officialOverlayField(value, column.left, firstTop + rowIndex * step, column.width, 1.42, className);
    }).join('');
  }).join('');
}

function renderDyp192SupportRows(items, firstTop) {
  return Array.from({ length: 5 }, (_unused, rowIndex) => {
    const item = items[rowIndex] || {};
    return officialOverlayField(formatAmmoLine(item), 23.80, firstTop + rowIndex * 3.695, 59.03, 1.72, 'dyp192-overlay dyp192-list-overlay');
  }).join('');
}

function splitEfed506Items(items = [], target) {
  const source = Array.isArray(items) ? items : [];
  const filtered = source.filter((item) => {
    const type = String(item.itemType || item.item_type || '').toLowerCase();
    if (target === 'used') {
      return type === 'used' || type === 'consumed' || item.transactionType === 'Χρέωση';
    }
    return type === 'produced' || item.transactionType === 'Πίστωση';
  });
  return filtered.length ? filtered : (target === 'used' ? source : []);
}

function normalizeDyp192SupportItems(items = [], target) {
  const source = Array.isArray(items) ? items : [];
  const filtered = source.filter((item) => {
    const type = String(item.itemType || item.item_type || '').toLowerCase();
    return target === 'consumed' ? type === 'consumed' : type === 'empty';
  });
  return filtered.length ? filtered : (target === 'consumed' ? source : []);
}

function getEfed506ItemValue(item, key) {
  if (key === 'nomenclatureNumber') return item.nomenclatureNumber || item.nominalNumber || '';
  if (key === 'measurementUnit') return item.measurementUnit || item.unit || '';
  if (key === 'supportingDocuments') return item.supportingDocuments || item.remarks || '';
  return item[key] || '';
}

function formatAmmoLine(item = {}) {
  const description = item.description || '';
  const quantity = item.quantity ?? '';
  if (!description && (quantity === '' || quantity === null || quantity === undefined)) return '';
  if (quantity === '' || quantity === null || quantity === undefined) return description;
  return `${description} - ${quantity}`;
}

function shortYear(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{4})/);
  return match ? match[1].slice(-2) : text.slice(-2);
}

export function renderSupportApplicationFields(definition, formData, documentData, support) {
  const fields = [];
  const seen = new Set();
  definition.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (seen.has(field.name)) return;
      seen.add(field.name);
      fields.push(field);
    });
  });
  const hasSplitDate = fields.some((field) => ['day', 'month', 'year'].includes(field.name));
  const visibleFields = fields.filter((field) => !['day', 'month', 'year'].includes(field.name));
  const dateControlNames = new Set(['periodFrom', 'periodTo', 'exerciseDate', 'documentDate', 'changeDate', 'firingDate']);
  return `
    <section class="support-application-fields no-print">
      <h3>Πεδία Συμπλήρωσης Εντύπου</h3>
      <div class="support-form-fields">
        ${supportFormField('Αριθμός και ημερομηνία', 'documentReference', formData.documentReference || support.documentReference)}
        ${hasSplitDate ? renderSplitSupportDateFields(formData, documentData) : ''}
        ${visibleFields.map((field) => supportFormField(
          supportFieldLabel(field.name),
          field.name,
          getSupportFieldValue(field.name, formData, documentData),
          Boolean(field.multiline),
          dateControlNames.has(field.name) ? 'date' : 'text'
        )).join('')}
      </div>
    </section>
  `;
}

function renderSplitSupportDateFields(formData, documentData) {
  const combined = getCombinedSupportDate(formData) || String(documentData?.date || '').slice(0, 10);
  const fallbackDate = combined ? new Date(combined) : new Date();
  const currentYear = new Date().getFullYear();
  const day = formData.day || (Number.isFinite(fallbackDate.getDate()) ? String(fallbackDate.getDate()).padStart(2, '0') : '');
  const month = formData.month || getGreekMonthName(fallbackDate.getMonth() + 1);
  const year = formData.year || (Number.isFinite(fallbackDate.getFullYear()) ? String(fallbackDate.getFullYear()) : String(currentYear));
  const yearOptions = [...new Set([currentYear - 1, currentYear, currentYear + 1, Number(year)].filter(Number.isFinite))]
    .sort((a, b) => a - b);
  return `
    ${supportSelectField('Ημέρα σύνταξης', 'day', day, Array.from({ length: 31 }, (_unused, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: String(index + 1)
    })))}
    ${supportSelectField('Μήνας σύνταξης', 'month', month, GREEK_MONTH_NAMES.map((name) => ({ value: name, label: name })))}
    ${supportSelectField('Έτος σύνταξης', 'year', year, yearOptions.map((value) => ({
      value: String(value),
      label: String(value)
    })))}
  `;
}

const GREEK_MONTH_NAMES = [
  'Ιανουάριος',
  'Φεβρουάριος',
  'Μάρτιος',
  'Απρίλιος',
  'Μάιος',
  'Ιούνιος',
  'Ιούλιος',
  'Αύγουστος',
  'Σεπτέμβριος',
  'Οκτώβριος',
  'Νοέμβριος',
  'Δεκέμβριος'
];

function getGreekMonthName(monthNumber) {
  return GREEK_MONTH_NAMES[Math.max(1, Math.min(12, Number(monthNumber) || 1)) - 1];
}

function getSupportFieldValue(name, formData, documentData) {
  const defaults = {
    unit: documentData.unit,
    exhpSerial: documentData.registryNumber,
    registry: documentData.registryNumber,
    place: documentData.serviceLocation || '',
    location: documentData.serviceLocation || ''
  };
  return formData[name] ?? defaults[name] ?? '';
}

function getCombinedSupportDate(formData) {
  if (formData.documentDate) return formData.documentDate;
  const month = greekMonthNumber(formData.month);
  if (!formData.year || !month || !formData.day) return '';
  return `${String(formData.year).padStart(4, '0')}-${month}-${String(formData.day).padStart(2, '0')}`;
}

function isSupportDateField(name) {
  return ['periodFrom', 'periodTo', 'exerciseDate', 'documentDate', 'changeDate', 'firingDate'].includes(name);
}

function supportFieldLabel(name) {
  const labels = {
    unit: 'Μονάδα',
    exhpSerial: 'Α/Α ΕΧΠ',
    registry: 'Αριθμός Ευρετηρίου',
    year: 'Έτος',
    place: 'Τόπος συντάξεως',
    day: 'Ημέρα',
    month: 'Μήνας',
    committeeOrder: 'Διαταγή συγκρότησης επιτροπής',
    chairman: 'Πρόεδρος επιτροπής',
    member1: 'Μέλος επιτροπής 1',
    member2: 'Μέλος επιτροπής 2',
    periodFrom: 'Περίοδος από',
    periodTo: 'Περίοδος έως',
    purpose: 'Σκοπός',
    compositionNumber: 'Αριθμός σύνθεσης',
    issueDocument: 'Δικαιολογητικό χορήγησης',
    issuingUnit: 'Χορηγούσα μονάδα',
    compositionTitle: 'Σύνθεση / τίτλος συλλογής',
    registryNumber: 'Αριθμός καταχώρησης',
    nominalNumber: 'Αριθμός ονομαστικού',
    mainDescription: 'Περιγραφή κυρίου υλικού',
    plannedCount: 'Προβλεπόμενη ποσότητα',
    actualCount: 'Πραγματική ποσότητα',
    supervisor: 'Αξκός επόπτης / εκπαιδευτής',
    exercise: 'Άσκηση / βολή',
    exerciseDate: 'Ημερομηνία άσκησης',
    weekday: 'Ημέρα εβδομάδας',
    consumedA: 'Καταναλωθέντα α',
    consumedB: 'Καταναλωθέντα β',
    consumedC: 'Καταναλωθέντα γ',
    recoveredMaterials: 'Υλικά συσκευασίας / περισυλλογής',
    copies: 'Αντίγραφα',
    serial: 'Αύξων αριθμός',
    fromUnit: 'Από',
    toUnit: 'Προς',
    documentDate: 'Ημερομηνία δικαιολογητικού',
    base: 'Έδρα μονάδας',
    subunit: 'Υπομονάδα',
    period: 'Περίοδος λογαριασμού',
    esso: 'ΕΣΣΟ',
    rank: 'Βαθμός',
    corps: 'Όπλο ή Σώμα',
    militaryNumber: 'Α.Σ.Μ.',
    fullName: 'Ονοματεπώνυμο',
    opinion: 'Γνωμάτευση επιτροπής'
  };
  return labels[name] || name;
}

export function getFaithfulFormDefinition(code, title) {
  const fields = {
    efed505: [
      { name: 'unit', x: 12, y: 13, w: 25 },
      { name: 'exhpSerial', x: 71, y: 13, w: 12 },
      { name: 'place', x: 20, y: 22, w: 21 },
      { name: 'day', x: 53, y: 22, w: 10 },
      { name: 'month', x: 72, y: 22, w: 14 },
      { name: 'year', x: 35, y: 25, w: 8 },
      { name: 'committeeOrder', x: 31, y: 28, w: 32 },
      { name: 'chairman', x: 25, y: 32, w: 45 },
      { name: 'member1', x: 25, y: 35, w: 45 },
      { name: 'member2', x: 25, y: 38, w: 45 },
      { name: 'periodFrom', x: 33, y: 48, w: 18 },
      { name: 'periodTo', x: 61, y: 48, w: 18 },
      { name: 'purpose', x: 13, y: 52, w: 72 }
    ],
    efed506: [
      { name: 'unit', x: 17, y: 13, w: 23 },
      { name: 'exhpSerial', x: 72, y: 13, w: 12 },
      { name: 'place', x: 21, y: 22, w: 20 },
      { name: 'day', x: 53, y: 22, w: 10 },
      { name: 'month', x: 72, y: 22, w: 14 },
      { name: 'year', x: 35, y: 25, w: 8 },
      { name: 'committeeOrder', x: 17, y: 29, w: 48 },
      { name: 'chairman', x: 25, y: 32, w: 47 },
      { name: 'member1', x: 25, y: 35, w: 47 },
      { name: 'member2', x: 25, y: 38, w: 47 }
    ],
    dyp190: [
      { name: 'compositionNumber', x: 34, y: 13, w: 22 },
      { name: 'issueDocument', x: 46, y: 17, w: 22 },
      { name: 'issuingUnit', x: 77, y: 17, w: 17 },
      { name: 'compositionTitle', x: 12, y: 21, w: 81 }
    ],
    dyp191: [
      { name: 'registryNumber', x: 25, y: 16, w: 25 },
      { name: 'nominalNumber', x: 25, y: 20, w: 25 },
      { name: 'mainDescription', x: 44, y: 25, w: 43 },
      { name: 'plannedCount', x: 75, y: 29, w: 8 },
      { name: 'actualCount', x: 89, y: 29, w: 7 }
    ],
    dyp192: [
      { name: 'supervisor', x: 32, y: 17, w: 46 },
      { name: 'unit', x: 31, y: 22, w: 49 },
      { name: 'exercise', x: 15, y: 29, w: 72 },
      { name: 'exerciseDate', x: 29, y: 33, w: 19 },
      { name: 'weekday', x: 66, y: 33, w: 20 },
      { name: 'consumedA', x: 18, y: 43, w: 68 },
      { name: 'consumedB', x: 18, y: 48, w: 68 },
      { name: 'consumedC', x: 18, y: 53, w: 68 },
      { name: 'recoveredMaterials', x: 17, y: 65, w: 70, h: 17, multiline: true },
      { name: 'copies', x: 39, y: 87, w: 9 }
    ],
    efed410: [
      { name: 'serial', x: 21, y: 10, w: 16 },
      { name: 'fromUnit', x: 16, y: 15, w: 28 },
      { name: 'toUnit', x: 16, y: 19, w: 28 },
      { name: 'documentDate', x: 60, y: 15, w: 18 },
      { name: 'registry', x: 60, y: 19, w: 18 }
    ],
    clothing: [
      { name: 'base', x: 18, y: 11, w: 24 },
      { name: 'unit', x: 18, y: 14, w: 24 },
      { name: 'subunit', x: 18, y: 17, w: 24 },
      { name: 'period', x: 60, y: 14, w: 24 },
      { name: 'esso', x: 60, y: 17, w: 18 },
      { name: 'exhpSerial', x: 79, y: 17, w: 12 }
    ],
    clothingSummary: [
      { name: 'unit', x: 77, y: 16, w: 14 },
      { name: 'month', x: 77, y: 21, w: 14 }
    ],
    dyp8: [
      { name: 'unit', x: 13, y: 11, w: 23 },
      { name: 'subunit', x: 47, y: 11, w: 22 },
      { name: 'rank', x: 13, y: 15, w: 16 },
      { name: 'corps', x: 38, y: 15, w: 16 },
      { name: 'militaryNumber', x: 64, y: 15, w: 17 },
      { name: 'fullName', x: 18, y: 19, w: 42 },
      { name: 'esso', x: 74, y: 19, w: 13 }
    ],
    useless: [
      { name: 'chairman', x: 19, y: 17, w: 47 },
      { name: 'member1', x: 19, y: 21, w: 47 },
      { name: 'member2', x: 19, y: 25, w: 47 },
      { name: 'committeeOrder', x: 26, y: 31, w: 55 },
      { name: 'opinion', x: 10, y: 65, w: 80, h: 15, multiline: true }
    ]
  };
  const standardColumns = [
    { key: 'serial', x: 9, w: 5, value: (_item, index) => index + 1 },
    { key: 'nominalNumber', x: 15, w: 21 },
    { key: 'description', x: 37, w: 27 },
    { key: 'measurementUnit', x: 65, w: 10 },
    { key: 'quantity', x: 76, w: 9 },
    { key: 'supportingDocuments', x: 86, w: 8 }
  ];
  if (code === 'ΕΦΕΔ 505') return { pages: [{ image: 'te34-254-page-248.png', fields: fields.efed505, table: { y: 51.2, step: 2.15, rows: 12, columns: standardColumns } }] };
  if (code === 'ΕΦΕΔ 506') return { renderer: 'efed506', pages: [{ image: 'efed-506-clean.png', fields: fields.efed506 }] };
  if (code === 'ΔΥΠ/190') return {
    pages: [{
      image: 'te34-254-page-266.png',
      fields: fields.dyp190,
      table: {
        source: 'composition', y: 32.5, step: 3.15, rows: 16,
        columns: [
          { key: 'serial', x: 4, w: 5, value: (_item, index) => index + 1 },
          { key: 'componentNominalNumber', x: 10, w: 17 },
          { key: 'componentDescription', x: 28, w: 23 },
          { key: 'measurementUnit', x: 52, w: 12 },
          { key: 'quantity', x: 65, w: 7 }
        ]
      }
    }]
  };
  if (code === 'ΔΥΠ/191') return {
    pages: [{
      image: 'te34-254-page-267.png',
      orientation: 'landscape',
      fields: fields.dyp191,
      table: {
        source: 'changes', y: 43, step: 3.15, rows: 10,
        columns: [
          { key: 'nominalNumber', x: 9, w: 19 },
          { key: 'changeReason', x: 29, w: 28 },
          { key: 'changeDate', x: 58, w: 9 },
          { key: 'newValue', x: 68, w: 10 },
          { key: 'previousValue', x: 79, w: 10 }
        ]
      }
    }]
  };
  if (code === 'ΔΥΠ/192') return { renderer: 'dyp192', pages: [{ image: 'dyp192-clean.png', fields: fields.dyp192 }] };
  if (code === 'ΕΦΕΔ 410') return { pages: [{ image: 'te34-254-page-239.png', fields: fields.efed410, table: { y: 25.5, step: 3.3, rows: 16, columns: standardColumns } }] };
  if (code.includes('ΔΥΠ/9-10-11')) {
    return {
      pages: [
        ...[256, 257, 258, 259, 260, 261].map((number, index) => ({
          image: `te34-254-page-${number}.png`,
          orientation: 'landscape',
          fields: index % 2 === 0 ? fields.clothing : []
        })),
        { image: 'te34-254-page-265.png', orientation: 'landscape', fields: fields.clothingSummary }
      ]
    };
  }
  if (code.includes('ΔΥΠ/8')) return {
    pages: [
      { image: 'te34-254-page-254.png', orientation: 'landscape', fields: fields.dyp8 },
      { image: 'te34-254-page-255.png', orientation: 'landscape', fields: [] }
    ]
  };
  if (code === 'ΑΧΡΗΣΤΟ/1-23') {
    return {
      pages: [
        { image: 'te34-254-page-270.png', fields: fields.useless },
        { image: 'te34-254-page-271.png', fields: [] },
        { image: 'te34-254-page-272.png', fields: [] },
        { image: 'te34-254-page-275.png', fields: [] },
        { image: 'te34-254-page-276.png', fields: [] },
        { image: 'te34-254-page-280.png', fields: [] },
        { image: 'te34-254-page-281.png', fields: fields.useless },
        { image: 'te34-254-page-282.png', fields: [] },
        { image: 'te34-254-page-283.png', fields: [] },
        { image: 'te34-254-page-284.png', fields: [] },
        { image: 'te34-254-page-287.png', fields: [] },
        { image: 'te34-254-page-288.png', fields: [] }
      ]
    };
  }
  if (String(title || '').toLocaleLowerCase('el-GR').includes('επιτροπής επιθεώρησης')) {
    return { pages: [{ image: 'te34-254-page-270.png', fields: fields.useless }] };
  }
  return null;
}

function officialInput(name, value = '', className = '') {
  return `<span class="official-inline-value ${className}" data-support-preview-field="${name}">${escapeHtml(value || '')}</span>`;
}

function officialTextarea(name, value = '', rows = 3) {
  return `<div class="official-text-value" data-support-preview-field="${name}" style="min-height:${Math.max(1, rows) * 1.4}em">${escapeHtml(value || '')}</div>`;
}

function renderEfed505(documentData, formData) {
  return `
    <section class="official-support-form">
      <div class="official-form-top"><span>1. ΜΟΝΑΔΑ ${officialInput('unit', formData.unit || documentData.unit)}</span><span>(2) Α/Α ΕΧΠ ${officialInput('exhpSerial', formData.exhpSerial || documentData.registryNumber)}</span></div>
      <h2>Π Ρ Ω Τ Ο Κ Ο Λ Λ Ο<br />ΔΙΑΘΕΣΕΩΣ ΑΝΑΛΩΣΙΜΟΥ ΥΛΙΚΟΥ</h2>
      <p>Στ ${officialInput('place', formData.place)} σήμερα την ${officialInput('day', formData.day)} του μηνός ${officialInput('month', formData.month)} του έτους ${officialInput('year', formData.year || String(documentData.date || '').slice(0, 4))}, η Επιτροπή που συγκροτήθηκε με την ${officialInput('committeeOrder', formData.committeeOrder)} Η.Δ.Μ. και αποτελείται από τους:</p>
      <p>α. ${officialInput('chairman', formData.chairman, 'wide')} ως Πρόεδρο<br />β. ${officialInput('member1', formData.member1, 'wide')}<br />γ. ${officialInput('member2', formData.member2, 'wide')} ως μέλη,</p>
      <p class="official-centered">Π ρ ο έ β η</p>
      <p>στη διαπίστωση της καλής διάθεσης των παρακάτω αναλωσίμων υλικών κατά το χρονικό διάστημα από ${officialInput('periodFrom', formData.periodFrom)} έως ${officialInput('periodTo', formData.periodTo)} για ${officialInput('purpose', formData.purpose, 'wide')}.</p>
      ${renderOfficialItemsTable(documentData.items, 12)}
      <p>Η διάθεση των παραπάνω υλικών έγινε καλώς και σύμφωνα με τις ισχύουσες Διαταγές.</p>
      ${officialTextarea('closingNotes', formData.closingNotes, 2)}
      ${officialSignatures(['ΘΕΩΡΗΘΗΚΕ Ο ΔΙΟΙΚΗΤΗΣ', 'Ο ΔΙΑΧΕΙΡΙΣΤΗΣ', 'Η ΕΠΙΤΡΟΠΗ', 'Ο ΠΡΟΕΔΡΟΣ', 'ΤΑ ΜΕΛΗ'])}
    </section>
  `;
}

function renderEfed506(documentData, formData) {
  const chargeItems = documentData.items.filter((item) => item.transactionType === 'Πίστωση');
  const creditItems = documentData.items.filter((item) => item.transactionType === 'Χρέωση');
  return `
    <section class="official-support-form">
      <div class="official-form-top"><span>1. ΜΟΝΑΔΑ ${officialInput('unit', formData.unit || documentData.unit)}</span><span>(2) Α/Α ΕΧΠ ${officialInput('exhpSerial', formData.exhpSerial || documentData.registryNumber)}</span></div>
      <h2>Π Ρ Ω Τ Ο Κ Ο Λ Λ Ο<br />ΜΕΤΑΣΧΗΜΑΤΙΣΜΟΥ ΥΛΙΚΩΝ</h2>
      <p>Στ ${officialInput('place', formData.place)} σήμερα την ${officialInput('day', formData.day)} του μηνός ${officialInput('month', formData.month)} του έτους ${officialInput('year', formData.year || String(documentData.date || '').slice(0, 4))}, η Επιτροπή που συγκροτήθηκε με την ${officialInput('committeeOrder', formData.committeeOrder)} Διαταγή και αποτελείται από τους:</p>
      <p>α. ${officialInput('chairman', formData.chairman, 'wide')} ως Πρόεδρο<br />β. ${officialInput('member1', formData.member1, 'wide')}<br />γ. ${officialInput('member2', formData.member2, 'wide')} ως μέλη.</p>
      <p class="official-centered">Π ρ ο έ β η</p>
      <p>στη διαπίστωση του μετασχηματισμού (κατασκευή ή ανασκευή) των παρακάτω υλικών:</p>
      <h3>Α' ΧΡΗΣΙΜΟΠΟΙΗΘΕΝΤΑ ΕΙΔΗ</h3>${renderOfficialItemsTable(chargeItems, 6, documentData.items)}
      <h3>Β' ΠΑΡΑΧΘΕΝΤΑ ΕΙΔΗ</h3>${renderOfficialItemsTable(creditItems, 6, documentData.items)}
      ${officialTextarea('closingNotes', formData.closingNotes, 2)}
      ${officialSignatures(['ΘΕΩΡΗΘΗΚΕ Ο ΔΙΟΙΚΗΤΗΣ', 'Ο ΔΙΑΧΕΙΡΙΣΤΗΣ', 'Η ΕΠΙΤΡΟΠΗ'])}
    </section>
  `;
}

function renderDyp190(documentData, formData) {
  const rows = (documentData.materialAttachments && documentData.materialAttachments.composition) || [];
  return `
    <section class="official-support-form dyp190-form">
      <h2>ΚΑΤΑΣΤΑΣΗ ΣΥΝΘΕΣΕΩΣ</h2>
      <p>1. ΑΡΙΘΜΟΣ ΣΥΝΘΕΣΕΩΣ: ${officialInput('compositionNumber', formData.compositionNumber)}</p>
      <p>2. ΑΡΙΘΜ. ΗΜΕΡΟΜ. ΔΙΚΑΙΟΛ. ΧΟΡΗΓΗΣΕΩΣ: ${officialInput('issueDocument', formData.issueDocument)} &nbsp; 3. ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ: ${officialInput('issuingUnit', formData.issuingUnit || documentData.unit)}</p>
      <p>4. ΣΥΝΘΕΣΗ (Α/Ο - ΠΕΡΙΓΡΑΦΗ - ΤΙΤΛΟΣ ΣΥΛΛΟΓΗΣ): ${officialInput('compositionTitle', formData.compositionTitle, 'wide')}</p>
      <table class="index-table official-items-table"><thead><tr><th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th><th>ΠΡΟΒΛΕΠΟΜ. ΑΡΙΘ.</th><th>ΠΡΟΒΛΕΠΟΜ. ΟΛΟΓΡΑΦ.</th><th>ΜΗ ΧΟΡΗΓΗΘΕΙΣΑ ΑΡΙΘ.</th><th>ΜΗ ΧΟΡΗΓΗΘΕΙΣΑ ΟΛΟΓΡΑΦ.</th></tr></thead>
      <tbody>${padOfficialRows(rows, 16, 8, (item, index) => `<td>${index + 1}</td><td>${escapeHtml(item.componentNominalNumber)}</td><td class="material-description-cell">${escapeHtml(item.componentDescription)}</td><td>${escapeHtml(item.measurementUnit)}</td><td>${formatQuantity(item.quantity)}</td><td></td><td></td><td></td>`)}</tbody></table>
      <div class="official-form-top"><span>13. ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ</span><span>14. ΠΑΡΑΛΑΜΒΑΝΟΥΣΑ ΜΟΝΑΔΑ<br />${officialInput('receivingUnit', formData.receivingUnit)}</span></div>
    </section>
  `;
}

function renderDyp191(documentData, formData) {
  const rows = (documentData.materialAttachments && documentData.materialAttachments.changes) || [];
  return `
    <section class="official-support-form dyp191-form">
      <h2>ΦΥΛΛΟ ΜΕΤΑΒΟΛΩΝ ΕΙΔΩΝ ΣΥΝΘΕΣΕΩΣ<br />ΣΥΛΛΟΓΗΣ ΕΡΓΑΛΕΙΩΝ Ή ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ ΚΥΡΙΩΝ ΥΛΙΚΩΝ</h2>
      <p>ΑΡΙΘΜ. ΚΑΤΑΧΩΡΗΣΗΣ: ${officialInput('registryNumber', formData.registryNumber)} &nbsp; ΑΡΙΘΜ. ΟΝΟΜΑΣΤΙΚΟΥ: ${officialInput('nominalNumber', formData.nominalNumber)}</p>
      <p>ΠΕΡΙΓΡΑΦΗ ΚΥΡΙΟΥ ΥΛΙΚΟΥ Ή ΤΙΤΛΟΣ ΣΥΛΛΟΓΗΣ: ${officialInput('mainDescription', formData.mainDescription, 'wide')}</p>
      <table class="index-table official-items-table"><thead><tr><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΗΜΕΡΟΜΗΝΙΑ</th><th>ΧΡΕΩΣΗ</th><th>ΠΙΣΤΩΣΗ</th><th>ΠΛΕΟΝΑΣΜΑ</th><th>ΕΛΛΕΙΜΜΑ</th></tr></thead>
      <tbody>${padOfficialRows(rows, 12, 7, (item) => `<td></td><td class="material-description-cell">${escapeHtml(item.changeReason)}</td><td>${formatDate(item.changeDate)}</td><td>${escapeHtml(item.newValue)}</td><td>${escapeHtml(item.previousValue)}</td><td></td><td></td>`)}</tbody></table>
    </section>
  `;
}

function renderDyp192(documentData, formData) {
  return `
    <section class="official-support-form dyp192-form">
      <h2>ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΚΑΤΑΝΑΛΩΣΕΩΣ ΠΥΡΟΜΑΧΙΚΩΝ</h2>
      <p>Ο υπογεγραμμένος (Βαθμός - Ονοματεπώνυμο) ${officialInput('supervisor', formData.supervisor, 'wide')} Αξκός Επόπτης Βολής ή εκπαιδευτής της ${officialInput('unit', formData.unit || documentData.unit)} πιστοποιώ για την κατανάλωση πυρομαχικών κατά την ${officialInput('exercise', formData.exercise, 'wide')} που πραγματοποιήθηκε την ${officialInput('exerciseDate', formData.exerciseDate)} ημέρα της εβδομάδας ${officialInput('weekday', formData.weekday)}.</p>
      <h3>Π Ι Σ Τ Ο Π Ο Ι Ω</h3>
      <p>1. Ότι καταναλώθηκαν τα παρακάτω κατά είδος πυρομαχικά εκπαιδεύσεως:</p>
      ${renderOfficialItemsTable(documentData.items, 8)}
      <p>2. Υλικά συσκευασίας που περισυλλέχθηκαν και παραδόθηκαν:</p>
      ${officialTextarea('recoveredMaterials', formData.recoveredMaterials, 6)}
      <p>Αφού συντάχθηκε το παρόν σε ${officialInput('copies', formData.copies)} αντίγραφα, υπογράφεται όπως παρακάτω:</p>
      ${officialSignatures(['ΘΕΩΡΗΘΗΚΕ Ο ΠΕΔ', 'Ο ΜΕΡΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ', 'Ο ΑΞΚΟΣ ΒΟΛΗΣ Ή ΕΚΠΤΗΣ'])}
    </section>
  `;
}

function renderEfed410(documentData, formData) {
  return `
    <section class="official-support-form">
      <h2>ΔΕΛΤΙΟ ΧΟΡΗΓΗΣΗΣ</h2>
      <div class="official-form-top"><span>1. ΑΥΞ. ΑΡΙΘ. ${officialInput('serial', formData.serial)}</span><span>4. ΑΡΙΘΜΟΣ ΕΥΡΕΤ. ${officialInput('registry', formData.registry || documentData.registryNumber)}</span></div>
      <p>2. ΑΠΟ ${officialInput('fromUnit', formData.fromUnit || documentData.unit)} &nbsp; 3. ΠΡΟΣ ${officialInput('toUnit', formData.toUnit)}</p>
      <table class="index-table official-items-table"><thead><tr><th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>Μ/Μ</th><th>ΠΟΣΟΤΗΤΑ ΠΡΟΒΛΕΠ.</th><th>ΠΟΣΟΤΗΤΑ ΧΟΡΗΓΟΥΜ.</th><th>ΠΑΡΑΤΗΡΗΣΕΙΣ</th></tr></thead>
      <tbody>${padOfficialRows(documentData.items, 16, 7, (item, index) => `<td>${index + 1}</td>${officialMaterialCell(item, index, 'nominalNumber', true)}${officialMaterialCell(item, index, 'description', false, 'material-description-cell')}${officialMaterialCell(item, index, 'measurementUnit')}<td></td><td>${formatQuantity(item.quantity)}</td><td>${escapeHtml(item.supportingDocuments || '')}</td>`)}</tbody></table>
      ${officialSignatures(['Ο ΧΟΡΗΓΩΝ', 'Ο ΠΑΡΑΛΑΜΒΑΝΩΝ', 'ΘΕΩΡΗΘΗΚΕ'])}
    </section>
  `;
}

function renderClothingStatement(documentData, formData) {
  return `
    <section class="official-support-form">
      <h2>ΚΑΤΑΣΤΑΣΗ ΔΙΚΑΙΟΛΟΓΗΣΗΣ ΕΙΔΩΝ ΙΜΑΤΙΣΜΟΥ ΚΑΙ ΑΤΟΜΙΚΗΣ ΧΡΗΣΗΣ</h2>
      <div class="support-form-fields">
        <p><strong>Έντυπο:</strong> ${escapeHtml(formData.formVariant || '')}</p>
        ${officialDisplayField('Έδρα Μονάδας', formData.base)}
        ${officialDisplayField('Μονάδα', formData.unit || documentData.unit)}
        ${officialDisplayField('Υπομονάδα', formData.subunit)}
        ${officialDisplayField('Περίοδος Λογαριασμού', formData.period)}
        ${officialDisplayField('ΕΣΣΟ', formData.esso)}
        ${officialDisplayField('Α/Α ΕΧΠ', formData.exhpSerial || documentData.registryNumber)}
      </div>
      <table class="index-table official-items-table"><thead><tr><th>Α/Α</th><th>ΣΤΡΑΤΙΩΤΙΚΑ ΣΤΟΙΧΕΙΑ</th><th>ΒΑΘΜΟΣ</th><th>ΟΝΟΜΑΤΕΠΩΝΥΜΟ</th><th>ΕΙΔΟΣ</th><th>ΠΟΣΟΤΗΤΑ</th><th>ΠΑΡΑΤΗΡΗΣΕΙΣ</th></tr></thead><tbody>${padOfficialRows(documentData.items, 15, 7, (item, index) => `<td>${index + 1}</td><td></td><td></td><td></td><td class="material-description-cell">${escapeHtml(item.description)}</td><td>${formatQuantity(item.quantity)}</td><td>${escapeHtml(item.supportingDocuments || '')}</td>`)}</tbody></table>
      ${officialSignatures(['Ο ΔΙΑΧΕΙΡΙΣΤΗΣ', 'Ο ΔΙΟΙΚΗΤΗΣ ΥΠΟΜΟΝΑΔΑΣ', 'ΘΕΩΡΗΘΗΚΕ'])}
    </section>
  `;
}

function renderIndividualClothingSheet(documentData, formData) {
  return `
    <section class="official-support-form">
      <h2>ΔΙΑΡΚΕΣ ΑΤΟΜΙΚΟ ΦΥΛΛΟ ΙΜΑΤΙΣΜΟΥ</h2>
      <div class="support-form-fields">
        ${officialDisplayField('Μονάδα', formData.unit || documentData.unit)}
        ${officialDisplayField('Υπομονάδα', formData.subunit)}
        ${officialDisplayField('Βαθμός', formData.rank)}
        ${officialDisplayField('Όπλο ή Σώμα', formData.corps)}
        ${officialDisplayField('Α.Σ.Μ.', formData.militaryNumber)}
        ${officialDisplayField('Ονοματεπώνυμο', formData.fullName)}
        ${officialDisplayField('ΕΣΣΟ', formData.esso)}
      </div>
      ${renderOfficialItemsTable(documentData.items, 18)}
      ${officialSignatures(['Ο ΔΙΑΧΕΙΡΙΣΤΗΣ', 'Ο ΧΡΕΩΜΕΝΟΣ'])}
    </section>
  `;
}

function renderUselessMaterialProtocol(documentData, formData) {
  return `
    <section class="official-support-form">
      <h2>ΠΡΩΤΟΚΟΛΛΟ ΕΠΙΘΕΩΡΗΣΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ</h2>
      <p>1. Η Επιτροπή αποτελείται από:</p>
      <p>α. ${officialInput('chairman', formData.chairman, 'wide')} ως Πρόεδρο<br />β. ${officialInput('member1', formData.member1, 'wide')}<br />γ. ${officialInput('member2', formData.member2, 'wide')} ως μέλη.</p>
      <p>2. Συγκροτήθηκε με τη διαταγή ${officialInput('committeeOrder', formData.committeeOrder, 'wide')} και επιθεώρησε τα παρακάτω υλικά:</p>
      ${renderOfficialItemsTable(documentData.items, 12)}
      <p>Γνωμάτευση Επιτροπής:</p>${officialTextarea('opinion', formData.opinion, 6)}
      ${officialSignatures(['Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ', 'Ο ΠΡΟΕΔΡΟΣ', 'ΤΑ ΜΕΛΗ'])}
    </section>
  `;
}

function renderOfficialItemsTable(items, rowCount, sourceItems = items) {
  return `<table class="index-table official-items-table"><thead><tr><th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th><th>ΠΟΣΟΤΗΤΑ</th><th>ΠΑΡ/ΣΕΙΣ</th></tr></thead><tbody>${padOfficialRows(items, rowCount, 6, (item, index) => {
    const itemIndex = sourceItems.indexOf(item);
    return `<td>${index + 1}</td>${officialMaterialCell(item, itemIndex, 'nominalNumber', true)}${officialMaterialCell(item, itemIndex, 'description', false, 'material-description-cell')}${officialMaterialCell(item, itemIndex, 'measurementUnit')}<td>${formatQuantity(item.quantity)}</td><td>${escapeHtml(item.supportingDocuments || '')}</td>`;
  })}</tbody></table>`;
}

function officialMaterialCell(item, itemIndex, key, isNominalCell = false, className = '') {
  const value = item[key] || '';
  return `<td class="${className}">${escapeHtml(value)}</td>`;
}

function padOfficialRows(items, rowCount, columnCount, renderer) {
  return Array.from({ length: Math.max(rowCount, items.length) }, (_unused, index) => {
    const item = items[index];
    return `<tr>${item ? renderer(item, index) : '<td></td>'.repeat(columnCount)}</tr>`;
  }).join('');
}

function officialSignatures(labels) {
  return `<div class="official-signatures">${labels.map((label) => `<div>${escapeHtml(label)}</div>`).join('')}</div>`;
}

function officialDisplayField(label, value = '') {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || '')}</p>`;
}

function supportFormField(label, name, value = '', multiline = false, type = 'text') {
  const control = multiline
    ? `<textarea data-support-form-field="${name}" rows="3">${escapeHtml(value || '')}</textarea>`
    : `<input data-support-form-field="${name}" type="${type}" value="${escapeHtml(value || '')}" />`;
  return `<label class="field"><span>${label}</span>${control}</label>`;
}

function supportSelectField(label, name, value = '', options = []) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select data-support-form-field="${escapeHtml(name)}">
        <option value=""></option>
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function renderSupportSpecificFields(support, formData) {
  const title = `${support.documentCode || ''} ${support.title || ''}`.toLocaleLowerCase('el-GR');
  let fields;
  if (title.includes('πρωτόκολλο')) {
    fields = [
      ['Σύνθεση επιτροπής', 'committeeComposition', true],
      ['Πραγματικά περιστατικά', 'circumstances', true],
      ['Πόρισμα επιτροπής', 'committeeConclusion', true]
    ];
  } else if (title.includes('δελτίο')) {
    fields = [
      ['Παραλήπτης / Χρήστης', 'recipient', false],
      ['Σκοπός χορηγήσεως', 'purpose', true],
      ['Στοιχεία παραδόσεως - παραλαβής', 'deliveryDetails', true]
    ];
  } else if (title.includes('κατάσταση') || title.includes('φελυ')) {
    fields = [
      ['Χρονική περίοδος', 'period', false],
      ['Υπόλογος', 'accountableOfficer', false],
      ['Στοιχεία ελέγχου / συμφωνίας', 'verification', true]
    ];
  } else if (title.includes('διαταγή') || title.includes('έγκριση')) {
    fields = [
      ['Αποδέκτες', 'recipients', true],
      ['Διατασσόμενη ενέργεια', 'orderedAction', true],
      ['Προθεσμία εκτελέσεως', 'deadline', false]
    ];
  } else {
    fields = [
      ['Πηγή στοιχείων', 'sourceReference', false],
      ['Τρόπος τακτοποιήσεως', 'settlementMethod', true],
      ['Συνημμένα', 'attachments', true]
    ];
  }
  return fields.map(([label, name, multiline]) =>
    supportFormField(label, name, formData[name], multiline)
  ).join('');
}

function renderSupportMaterialAttachment(documentData, support) {
  if (support.documentCode === 'ΔΥΠ/190') {
    const rows = (documentData.materialAttachments && documentData.materialAttachments.composition) || [];
    return `
      <section class="support-attachment-section">
        <h2>Σύνθεση Υλικού</h2>
        <table class="index-table inventory-print-table">
          <thead><tr><th>Μερίδα</th><th>Κύριο Υλικό</th><th>Αρ. Ονομαστικού</th><th>Εξάρτημα</th><th>Μ/Μ</th><th>Ποσότητα</th><th>Παρατηρήσεις</th></tr></thead>
          <tbody>${rows.length ? rows.map((item) => `<tr><td>${escapeHtml(item.shareNumber)}</td><td class="material-description-cell">${escapeHtml(item.parentDescription)}</td><td>${escapeHtml(item.componentNominalNumber)}</td><td class="material-description-cell">${escapeHtml(item.componentDescription)}</td><td>${escapeHtml(item.measurementUnit)}</td><td>${formatQuantity(item.quantity)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join('') : '<tr><td colspan="7">Δεν έχει καταχωρηθεί σύνθεση στην καρτέλα υλικού.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  }
  if (support.documentCode === 'ΔΥΠ/191') {
    const rows = (documentData.materialAttachments && documentData.materialAttachments.changes) || [];
    return `
      <section class="support-attachment-section">
        <h2>Φύλλο Μεταβολών Ειδών Συνθέσεως</h2>
        <table class="index-table inventory-print-table">
          <thead><tr><th>Μερίδα</th><th>Ημερομηνία</th><th>Διαταγή</th><th>Προηγούμενο</th><th>Νέο</th><th>Αιτιολογία</th><th>Παρατηρήσεις</th></tr></thead>
          <tbody>${rows.length ? rows.map((item) => `<tr><td>${escapeHtml(item.shareNumber)}</td><td>${formatDate(item.changeDate)}</td><td>${escapeHtml(item.orderReference)}</td><td>${escapeHtml(item.previousValue)}</td><td>${escapeHtml(item.newValue)}</td><td class="material-description-cell">${escapeHtml(item.changeReason)}</td><td>${escapeHtml(item.notes)}</td></tr>`).join('') : '<tr><td colspan="7">Δεν έχουν καταχωρηθεί μεταβολές στην καρτέλα υλικού.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  }
  return '';
}
