import { escapeHtml } from '../components/forms.js';

export function renderExhpSupportChecklist(container, templates, draftSupports = new Map(), options = {}) {
  const target = container.querySelector('#exhp-support-checklist');
  target?.classList.toggle('manual-only', options.showOfficialForms === false);
  const officialTemplates = options.showOfficialForms === false
    ? []
    : templates.filter((template) => template.printable);
  const officialForms = officialTemplates.length
    ? `
      <div class="exhp-support-grid official-exhp-support-grid">
        ${officialTemplates.map((template) => {
          const draft = draftSupports.get(template.id) || {};
          return `
            <div class="exhp-support-row official-exhp-support-row" data-exhp-official-template="${template.id}">
              <button class="secondary-button" data-open-support-template="${template.id}" type="button">${supportTemplateActionLabel(template, draft)}</button>
            </div>
          `;
        }).join('')}
      </div>
    `
    : '';
  target.innerHTML = `
    ${officialForms}
    <div class="requests-status-header">
      <div><h4>Δικαιολογητικά υποστήριξης</h4><p class="muted">Πρόσθεσε τα δικαιολογητικά που θα συνοδεύουν την ΕΧΠ.</p></div>
      <button class="secondary-button" data-add-manual-exhp-support type="button">Προσθήκη δικαιολογητικού</button>
    </div>
    <div class="exhp-support-grid" data-manual-exhp-support-list>
      ${renderManualExhpSupportRow()}
    </div>
  `;
}

function renderManualExhpSupportRow(value = '') {
  return `
    <label class="exhp-support-row manual-exhp-support-row" data-manual-exhp-support-row>
      <input data-manual-exhp-support value="${escapeHtml(value)}" placeholder="π.χ. Διαταγή 123/2026" />
      <button class="secondary-button" data-remove-manual-exhp-support type="button">Διαγραφή</button>
    </label>
  `;
}

export function addManualExhpSupportRow(container, value = '') {
  container.querySelector('[data-manual-exhp-support-list]')?.insertAdjacentHTML(
    'beforeend',
    renderManualExhpSupportRow(value)
  );
}

export function setManualExhpSupportRows(container, values = []) {
  const list = container.querySelector('[data-manual-exhp-support-list]');
  if (!list) return;
  const rows = values.length ? values : [''];
  list.innerHTML = rows.map((value) => renderManualExhpSupportRow(value)).join('');
}

export function collectManualExhpSupportDocuments(container) {
  return Array.from(container.querySelectorAll('[data-manual-exhp-support]'))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

export function isInventorySupportTemplate(template) {
  const title = String(template?.title || '').toLocaleLowerCase('el-GR');
  return title.includes('κατάσταση απογραφής') || title.includes('διαπίστωσης διαφορών');
}

export function renderSupportTemplateCards(referenceData, reasonName) {
  if (!reasonName) {
    return '<p class="empty-table">Επίλεξε αιτιολογία ΕΧΠ για να εμφανιστούν τα έντυπα.</p>';
  }
  const templates = referenceData.exhpSupportTemplates.filter((item) => item.issueReason === reasonName);
  if (!templates.length) {
    return '<p class="empty-table">Δεν έχουν αντιστοιχιστεί έντυπα στη συγκεκριμένη αιτιολογία.</p>';
  }
  return templates.map((template) => `
    <article class="exhp-support-row">
      <span><strong>${escapeHtml(template.documentCode || 'Έντυπο')}</strong>${escapeHtml(template.title)}</span>
      <button class="secondary-button" data-open-support-template="${template.id}" type="button">${supportTemplateActionLabel(template)}</button>
    </article>
  `).join('');
}

function supportTemplateActionLabel(template, draft = {}) {
  if (isInventorySupportTemplate(template)) return 'Κατάσταση Απογραφής';
  return draft.completed ? 'Επεξεργασία εντύπου' : 'Συμπλήρωση εντύπου';
}

export function createDraftSupportDocument(referenceData, reason, items = [], container = null, settings = {}) {
  return {
    id: 0,
    registryNumber: '',
    date: new Date().toISOString().slice(0, 10),
    unit: container?.querySelector('#exhp-unit')?.value || referenceData.serviceName || '',
    reason,
    approvalReference: container?.querySelector('#exhp-approval-reference')?.value || '',
    notes: '',
    materialAttachments: { composition: [], changes: [] },
    availableShares: referenceData.shares || [],
    serviceLocation: settings?.serviceInfo?.serviceLocation || '',
    items
  };
}

export function collectExhpSupports(container, draftSupports = new Map()) {
  return Array.from(draftSupports.values())
    .filter((support) => Number(support.templateId))
    .map((support) => ({
      templateId: Number(support.templateId),
      completed: Boolean(support.completed),
      documentReference: support.documentReference || '',
      notes: support.notes || '',
      formData: support.formData || {}
    }));
}

export function captureExhpDraftSupports(container, draftSupports) {
  container.querySelectorAll('[data-exhp-official-template]').forEach((row) => {
    const templateId = Number(row.dataset.exhpOfficialTemplate);
    const existing = draftSupports.get(templateId);
    if (existing) draftSupports.set(templateId, { ...existing, templateId });
  });
}
