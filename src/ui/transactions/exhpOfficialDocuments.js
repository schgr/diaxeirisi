import { escapeHtml } from '../components/forms.js';
import { numberToGreekWords } from '../pages/sharesPage.js';
import {
  renderClothingDisposalStatement,
  renderOfficialAmmoConsumptionCertificate,
  renderOfficialUselessDifferencesProtocol,
  renderOfficialUselessProtocol
} from '../../exhpDocuments.js';
import {
  collectRows,
  formatDate,
  readOptionalNumber,
  readRowField,
  readSupportField,
  setReadonlyRowField
} from './shared.js';

export const USELESS_MATERIAL_FORMS = [
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_inspection', label: 'Πρωτόκολλο Επιθεώρησης', kind: 'primary' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_a', label: 'Κατάσταση Α — Υγειονομική Ταφή', code: 'Α', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΦΕΡΘΟΥΝ ΣΕ ΧΩΡΟΥΣ ΥΓΕΙΟΝΟΜΙΚΗΣ ΤΑΦΗΣ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_b', label: 'Κατάσταση Β — Πρώτες Ύλες', code: 'Β', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΤΡΑΠΟΥΝ ΣΕ ΠΡΩΤΕΣ ΥΛΕΣ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_d2', label: 'Κατάσταση Δ2 — Ηλεκτρικές Στήλες', code: 'Δ2', title: 'ΗΛΕΚΤΡΙΚΕΣ ΣΤΗΛΕΣ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΠΑΡΑΔΟΘΟΥΝ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_d3', label: 'Κατάσταση Δ3 — Ελαστικά Επίσωτρα', code: 'Δ3', title: 'ΕΛΑΣΤΙΚΑ ΕΠΙΣΩΤΡΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΠΑΡΑΔΟΘΟΥΝ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'differences', label: 'Πρωτόκολλο Διαφορών', kind: 'differences' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_inspection', label: 'Πρωτόκολλο Επιθεώρησης', kind: 'inspection' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_a', label: 'Κατάσταση Α — Μεταφέρθηκαν σε Ταφή', code: 'Α', title: 'ΥΛΙΚΑ ΠΟΥ ΜΕΤΑΦΕΡΘΗΚΑΝ ΣΕ ΧΩΡΟΥΣ ΥΓΕΙΟΝΟΜΙΚΗΣ ΤΑΦΗΣ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_b', label: 'Κατάσταση Β — Μετατράπηκαν σε Πρώτες Ύλες', code: 'Β', title: 'ΥΛΙΚΑ ΠΟΥ ΜΕΤΑΤΡΑΠΗΚΑΝ ΣΕ ΠΡΩΤΕΣ ΥΛΕΣ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_d2', label: 'Κατάσταση Δ2 — Παραδόθηκαν', code: 'Δ2', title: 'ΗΛΕΚΤΡΙΚΕΣ ΣΤΗΛΕΣ ΠΟΥ ΠΑΡΑΔΟΘΗΚΑΝ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_d3', label: 'Κατάσταση Δ3 — Παραδόθηκαν', code: 'Δ3', title: 'ΕΛΑΣΤΙΚΑ ΕΠΙΣΩΤΡΑ ΠΟΥ ΠΑΡΑΔΟΘΗΚΑΝ' }
];

export function renderUselessMaterialTabs() {
  return [...new Set(USELESS_MATERIAL_FORMS.map((item) => item.group))].map((group) => `
    <section class="exhp-document-tab-group">
      <h4>${escapeHtml(group)}</h4>
      <div class="exhp-document-subtabs">
        ${USELESS_MATERIAL_FORMS.filter((item) => item.group === group).map((item) => `<button class="secondary-button" data-open-useless-material-form="${item.key}" type="button">${escapeHtml(item.label)}</button>`).join('')}
      </div>
    </section>
  `).join('');
}

export function renderUselessBForm(data) {
  const value = data || {};
  return `
    <section class="exhp-entry-section">
      <h4>Πρωτόκολλο Δευτεροβάθμιας Επιτροπής</h4>
      <div class="exhp-controls">
        ${supportInput('Πρόεδρος', 'useless-b', 'president', value.president)}
        ${supportInput('Α΄Μέλος', 'useless-b', 'memberA', value.memberA)}
        ${supportInput('Β΄Μέλος', 'useless-b', 'memberB', value.memberB)}
        ${supportInput('Δκτής', 'useless-b', 'commander', value.commander)}
        ${supportInput('Γεν. Διαχειριστής', 'useless-b', 'generalManager', value.generalManager)}
        ${supportInput('Διαχειριστής Αχρήστου Υλικού', 'useless-b', 'uselessManager', value.uselessManager)}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αρ. Μερίδας</th>
              <th>Αρ. Ονομαστικού</th>
              <th>Περιγραφή</th>
              <th>ΜΜ</th>
              <th>Ποσότητα Πρωτοβάθμιας</th>
              <th>Ποσότητα Δευτεροβάθμιας</th>
              <th>Διαφορά (+)</th>
              <th>Διαφορά (-)</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-useless-b-items>
            ${renderExhpDocumentRows('useless-b', value.items || [])}
          </tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <button class="secondary-button" data-add-exhp-doc-row="useless-b" type="button">+ Προσθήκη Υλικού</button>
        <div class="row-actions">
          <button class="secondary-button" data-preview-exhp-doc="useless_material_b" type="button">Προβολή</button>
          <button class="primary-button" data-save-exhp-doc="useless_material_b" type="button">Αποθήκευση</button>
        </div>
      </div>
    </section>
  `;
}

export function renderAmmoTable(title, kind, items) {
  return `
    <section class="exhp-entry-section">
      <h4>${escapeHtml(title)}</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Περιγραφή</th>
              <th>Ποσότητα</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-${kind}-items>
            ${renderExhpDocumentRows(kind, items)}
          </tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <button class="secondary-button" data-add-exhp-doc-row="${kind}" type="button">+ Προσθήκη Γραμμής</button>
      </div>
    </section>
  `;
}

function supportInput(label, group, name, value = '', type = 'text') {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `
    <label class="field support-field">
      <span>${escapeHtml(label)}</span>
      <input data-${group}-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" />
    </label>
  `;
}

function renderExhpDocumentRows(kind, items) {
  if (!items.length) {
    return renderExhpDocumentItemRow(kind, {}, 0);
  }
  return items.map((item, index) => renderExhpDocumentItemRow(kind, item, index)).join('');
}

export function renderExhpDocumentItemRow(kind, item, index = 0) {
  if (kind === 'useless-a') {
    return `
      <tr>
        <td class="official-admin-column">${rowInputControl('shareNumber', item.shareNumber)}</td>
        <td>${escapeHtml(item.aa || index + 1)}</td>
        ${rowInput('nomenclatureNumber', item.nomenclatureNumber, 'text', Boolean(item.shareNumber))}
        ${rowInput('description', item.description, 'text', Boolean(item.shareNumber))}
        ${rowInput('unit', item.unit, 'text', Boolean(item.shareNumber))}
        ${rowInput('quantity', item.quantity, 'number')}
        ${rowInput('remarks', item.remarks)}
        <td class="official-admin-column"><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
      </tr>
    `;
  }

  if (kind === 'useless-b') {
    return `
      <tr>
        ${rowInput('shareNumber', item.shareNumber)}
        ${rowInput('nomenclatureNumber', item.nomenclatureNumber, 'text', Boolean(item.shareNumber))}
        ${rowInput('description', item.description, 'text', Boolean(item.shareNumber))}
        ${rowInput('unit', item.unit, 'text', Boolean(item.shareNumber))}
        ${rowInput('qtyPrimary', item.qtyPrimary, 'number')}
        ${rowInput('qtySecondary', item.qtySecondary, 'number')}
        ${rowInput('diffPlus', item.diffPlus, 'number')}
        ${rowInput('diffMinus', item.diffMinus, 'number')}
        <td><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
      </tr>
    `;
  }

  return `
    <tr>
      ${rowInput('description', item.description)}
      ${rowInput('quantity', item.quantity, 'number')}
      <td><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
    </tr>
  `;
}

function rowInput(name, value = '', type = 'text', readonly = false) {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `<td><input data-row-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" ${readonly ? 'readonly' : ''} /></td>`;
}

function rowInputControl(name, value = '', type = 'text', readonly = false) {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `<input data-row-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" ${readonly ? 'readonly' : ''} />`;
}

export async function ensureExhpSupportDocument(exhpDocsApi, documentsState, exhpId, documentType) {
  const existing = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === documentType
  );
  if (existing) return existing;

  const result = await exhpDocsApi.create(exhpId, documentType);
  const document = result.document || result;
  documentsState.supportDocuments.push(document);
  return document;
}

export function saveExhpDocumentForm(exhpDocsApi, documentType, documentId, editor) {
  if (documentType === 'useless_material_a') {
    return exhpDocsApi.saveUselessA(documentId, collectUselessA(editor));
  }
  if (documentType === 'useless_material_b') {
    return exhpDocsApi.saveUselessB(documentId, collectUselessB(editor));
  }
  return exhpDocsApi.saveAmmo(documentId, collectAmmo(editor));
}

export async function saveDraftExhpDocuments(exhpDocsApi, exhpId, issueReason, editor, documentsState) {
  if (!exhpDocsApi || !exhpId || !editor) return;
  const saveState = { supportDocuments: [] };
  if (isUselessMaterialReason(issueReason)) {
    if (documentsState?.draftUselessA) {
      const primaryDocument = await ensureExhpSupportDocument(
        exhpDocsApi,
        saveState,
        exhpId,
        'useless_material_a'
      );
      await exhpDocsApi.saveUselessA(primaryDocument.id, documentsState.draftUselessA);
    }
    if (documentsState?.draftUselessB) {
      const secondaryDocument = await ensureExhpSupportDocument(
        exhpDocsApi,
        saveState,
        exhpId,
        'useless_material_b'
      );
      await exhpDocsApi.saveUselessB(secondaryDocument.id, documentsState.draftUselessB);
    }
    for (const [formKey, payload] of Object.entries(documentsState?.uselessStatements || {})) {
      if (payload && Object.keys(payload).length) {
        await exhpDocsApi.saveUselessStatement(exhpId, formKey, payload);
      }
    }
    return;
  }
  if (isAmmoConsumptionReason(issueReason) && documentsState?.draftAmmo) {
    const ammoDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'ammo_consumption'
    );
    await exhpDocsApi.saveAmmo(ammoDocument.id, documentsState.draftAmmo);
  }
  if (documentsState?.newModuleDrafts?.d) {
    const transformationDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'transformation_materials'
    );
    await exhpDocsApi.saveGeneric(transformationDocument.id, documentsState.newModuleDrafts.d);
  }
  if (documentsState?.newModuleDrafts?.st) {
    const clothingDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'clothing_monthly_summary'
    );
    await exhpDocsApi.saveGeneric(clothingDocument.id, documentsState.newModuleDrafts.st);
  }
}

function collectUselessA(editor) {
  return {
    location: readSupportField(editor, 'useless-a', 'location'),
    date: readSupportField(editor, 'useless-a', 'date'),
    hdmNumber: readSupportField(editor, 'useless-a', 'hdmNumber'),
    president: readSupportField(editor, 'useless-a', 'president'),
    memberA: readSupportField(editor, 'useless-a', 'memberA'),
    memberB: readSupportField(editor, 'useless-a', 'memberB'),
    periodFrom: readSupportField(editor, 'useless-a', 'periodFrom'),
    periodTo: readSupportField(editor, 'useless-a', 'periodTo'),
    items: collectRows(editor, '[data-useless-a-items] tr').map((row, index) => ({
      aa: index + 1,
      shareNumber: readRowField(row, 'shareNumber'),
      nomenclatureNumber: readRowField(row, 'nomenclatureNumber'),
      description: readRowField(row, 'description'),
      unit: readRowField(row, 'unit'),
      quantity: readOptionalNumber(readRowField(row, 'quantity')),
      acquisitionPrice: readRowField(row, 'acquisitionPrice'),
      acquisitionDate: readRowField(row, 'acquisitionDate'),
      remarks: readRowField(row, 'remarks')
    }))
  };
}

function collectUselessB(editor) {
  return {
    president: readSupportField(editor, 'useless-b', 'president'),
    memberA: readSupportField(editor, 'useless-b', 'memberA'),
    memberB: readSupportField(editor, 'useless-b', 'memberB'),
    commander: readSupportField(editor, 'useless-b', 'commander'),
    generalManager: readSupportField(editor, 'useless-b', 'generalManager'),
    uselessManager: readSupportField(editor, 'useless-b', 'uselessManager'),
    items: collectRows(editor, '[data-useless-b-items] tr').map((row, index) => ({
      aa: index + 1,
      shareNumber: readRowField(row, 'shareNumber'),
      nomenclatureNumber: readRowField(row, 'nomenclatureNumber'),
      description: readRowField(row, 'description'),
      unit: readRowField(row, 'unit'),
      qtyPrimary: readOptionalNumber(readRowField(row, 'qtyPrimary')),
      qtySecondary: readOptionalNumber(readRowField(row, 'qtySecondary')),
      diffPlus: readOptionalNumber(readRowField(row, 'diffPlus')),
      diffMinus: readOptionalNumber(readRowField(row, 'diffMinus'))
    }))
  };
}

function collectAmmo(editor) {
  return {
    officerRank: readSupportField(editor, 'ammo', 'officerRank'),
    officerName: readSupportField(editor, 'ammo', 'officerName'),
    unit: readSupportField(editor, 'ammo', 'unit'),
    firingDate: readSupportField(editor, 'ammo', 'firingDate'),
    dayOfWeek: readSupportField(editor, 'ammo', 'dayOfWeek'),
    copiesCount: readOptionalNumber(readSupportField(editor, 'ammo', 'copiesCount')),
    items: [
      ...collectRows(editor, '[data-ammo-consumed-items] tr').map((row) => ({
        itemType: 'consumed',
        description: readRowField(row, 'description'),
        quantity: readOptionalNumber(readRowField(row, 'quantity'))
      })),
      ...collectRows(editor, '[data-ammo-empty-items] tr').map((row) => ({
        itemType: 'empty',
        description: readRowField(row, 'description'),
        quantity: readOptionalNumber(readRowField(row, 'quantity'))
      }))
    ]
  };
}

export async function autofillShareDocumentRow(input, showToast) {
  const row = input.closest('tr');
  if (!row) return;
  try {
    const share = await window.appApi.shares.getShareByNumber(input.value.trim());
    setReadonlyRowField(row, 'nomenclatureNumber', share.nomenclatureNumber || share.nominalNumber || '');
    setReadonlyRowField(row, 'description', share.description || '');
    setReadonlyRowField(row, 'unit', share.unit || share.measurementUnit || '');
    row.dataset.availableQuantity = String(
      share.quantity ?? share.availableQuantity ?? share.accountingBalance ?? ''
    );
  } catch (_error) {
    row.dataset.availableQuantity = '';
    ['nomenclatureNumber', 'description', 'unit'].forEach((name) => {
      const field = row.querySelector(`[data-row-field="${name}"]`);
      if (!field) return;
      field.value = '';
      field.readOnly = false;
    });
    showToast('Η μερίδα δεν βρέθηκε', 'error');
  }
}

export function collectExhpDocumentPreviewData(type, editor) {
  if (type === 'useless_material_a') return collectUselessA(editor);
  if (type === 'useless_material_b') return collectUselessB(editor);
  return collectAmmo(editor);
}

export function openExhpDocumentModal(type, exhp, data, settings, showToast) {
  const existing = document.querySelector('.exhp-official-document-backdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop exhp-official-document-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ ΕΧΠ</p>
          <h2>${escapeHtml(officialExhpDocumentTitle(type))}</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-exhp-official-document type="button">Κλείσιμο</button>
          <button class="secondary-button" data-edit-exhp-official-document type="button" hidden>← Επεξεργασία</button>
          <button class="secondary-button" data-save-exhp-official-document type="button">Αποθήκευση</button>
          <button class="primary-button" data-preview-exhp-official-document type="button">Προεπισκόπηση Εντύπου →</button>
          <button class="primary-button" data-print-exhp-official-document type="button" hidden>Εκτύπωση</button>
        </div>
      </header>
      ${renderExhpModalMetadata({
        registryNumber: exhp?.indexNumber || exhp?.registryNumber || '',
        date: data.date || data.firingDate || '',
        unit: exhp?.serviceUnit || data.unit || settings?.serviceInfo?.serviceName || '',
        reason: officialExhpDocumentTitle(type)
      })}
      <div class="official-document-form-state no-print" data-official-document-form>
        ${renderOfficialExhpDataForm(type, data, settings, exhp)}
      </div>
      <div class="handover-document-preview" data-official-document-preview hidden></div>
    </section>
  `;

  const form = modal.querySelector('[data-official-document-form]');
  const preview = modal.querySelector('.handover-document-preview');
  bindOfficialExhpDataForm(form, type, showToast);
  const setMode = (mode) => {
    const isPreview = mode === 'preview';
    form.hidden = isPreview;
    preview.hidden = !isPreview;
    modal.querySelector('[data-edit-exhp-official-document]').hidden = !isPreview;
    modal.querySelector('[data-print-exhp-official-document]').hidden = !isPreview;
    modal.querySelector('[data-preview-exhp-official-document]').hidden = isPreview;
  };

  modal.querySelector('[data-close-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    modal.remove();
  });
  modal.querySelector('[data-save-exhp-official-document]').addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      const payload = collectOfficialExhpDataForm(form, type);
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      if (!exhp.id) {
        exhp.onDraftSave?.(payload);
        showToast('Το έντυπο προετοιμάστηκε και θα αποθηκευτεί μαζί με την ΕΧΠ.');
        modal.remove();
        return;
      }

      const supportDocument = await ensureOfficialExhpDocument(type, exhp.id);
      const result = type === 'useless_material_a'
        ? await window.appApi.exhpDocs.saveUselessA(supportDocument.id, payload)
        : await window.appApi.exhpDocs.saveAmmo(supportDocument.id, payload);
      exhp.onDraftSave?.(payload);
      showToast(result.message || 'Το δικαιολογητικό αποθηκεύτηκε.');
      modal.remove();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του δικαιολογητικού.', 'error');
    }
  });
  modal.querySelector('[data-preview-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    const payload = collectOfficialExhpDataForm(form, type);
    if (!validateSharedMaterialPayload(payload, showToast)) return;
    preview.innerHTML = type === 'useless_material_a'
      ? renderOfficialUselessProtocol(settings, exhp, prepareUselessProtocolData(payload))
      : renderOfficialAmmoConsumptionCertificate(settings, exhp, payload);
    setMode('preview');
  });
  modal.querySelector('[data-edit-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('form');
  });
  modal.querySelector('[data-print-exhp-official-document]').addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await printExhpDocument(preview);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του δικαιολογητικού.', 'error');
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function renderExhpModalMetadata(documentData = {}) {
  return `
    <section class="exhp-modal-metadata no-print">
      <span><strong>Αρ. Ευρετηρίου:</strong> ${escapeHtml(documentData.registryNumber || '')}</span>
      <span><strong>Ημερομηνία:</strong> ${escapeHtml(formatDate(documentData.date) || '')}</span>
      <span><strong>Μονάδα:</strong> ${escapeHtml(documentData.unit || '')}</span>
      <span><strong>Αιτιολογία:</strong> ${escapeHtml(documentData.reason || '')}</span>
    </section>
  `;
}

async function printExhpDocument(preview) {
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

function renderOfficialExhpDataForm(type, data, settings, exhp) {
  if (type === 'useless_material_a') {
    const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];
    return `
      <section class="official-document-data-form">
        <div class="support-form-fields">
          ${officialDataField('Τόπος', 'location', data.location || settings?.serviceInfo?.serviceLocation || '')}
          ${officialDataField('Ημερομηνία', 'date', data.date || '', 'date')}
          ${officialDataField('Αρ. ΗΔΜ', 'hdmNumber', data.hdmNumber)}
          ${officialDataField('Πρόεδρος', 'president', data.president)}
          ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
          ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
          ${officialDataField('Περίοδος Από', 'periodFrom', data.periodFrom, 'date')}
          ${officialDataField('Περίοδος Έως', 'periodTo', data.periodTo, 'date')}
        </div>
        ${renderOfficialEditableMaterials(items)}
      </section>
    `;
  }
  const consumed = normalizeOfficialAmmoItems(data, 'consumed');
  const empty = normalizeOfficialAmmoItems(data, 'empty');
  return `
    <section class="official-document-data-form">
      <div class="support-form-fields">
        ${officialDataField('Βαθμός Αξκού Επόπτη', 'officerRank', data.officerRank)}
        ${officialDataField('Ονοματεπώνυμο Αξκού Επόπτη', 'officerName', data.officerName)}
        ${officialDataField('Μονάδα / Τμήμα', 'unit', data.unit || exhp?.serviceUnit || settings?.serviceInfo?.serviceName || '')}
        ${officialDataField('Ημερομηνία Βολής', 'firingDate', data.firingDate || data.date || '', 'date')}
        ${officialDataField('Ημέρα Εβδομάδας', 'dayOfWeek', data.dayOfWeek)}
        ${officialDataField('Αριθμός Αντιγράφων', 'copiesCount', data.copiesCount, 'number')}
      </div>
      ${renderOfficialAmmoEditableTable('Καταναλωθέντα', 'consumed', consumed)}
      ${renderOfficialAmmoEditableTable('Κενά Συσκευασίας', 'empty', empty)}
    </section>
  `;
}

function officialDataField(label, name, value = '', type = 'text') {
  return `<label class="field"><span>${escapeHtml(label)}</span><input data-official-form-field="${name}" type="${type}" value="${escapeHtml(value ?? '')}" autocomplete="off" /></label>`;
}

function renderOfficialEditableMaterials(items) {
  return `
    <section class="official-editable-materials">
      <h3>Υλικά</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Α/Α</th><th>Αρ. Μερίδας</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσότητα</th><th>Τιμή Κτήσης</th><th>Ημ. Κτήσης</th><th>Παρ/σεις</th><th></th></tr></thead>
        <tbody data-official-material-items>${items.map((item, index) => renderOfficialEditableMaterialRow(item, index)).join('')}</tbody>
      </table></div>
      <button class="secondary-button" data-add-official-material type="button">+ Προσθήκη Υλικού</button>
    </section>
  `;
}

function renderOfficialEditableMaterialRow(item = {}, index = 0) {
  return `<tr>
    <td data-official-row-number>${index + 1}</td>
    <td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td>
    <td><input data-official-item-field="nomenclatureNumber" value="${escapeHtml(item.nomenclatureNumber || item.nominalNumber || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="unit" value="${escapeHtml(item.unit || item.measurementUnit || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="quantity" type="number" step="0.001" value="${escapeHtml(item.quantity ?? '')}" /></td>
    <td><input data-official-item-field="acquisitionPrice" value="${escapeHtml(item.acquisitionPrice || '')}" /></td>
    <td><input data-official-item-field="acquisitionDate" type="date" value="${escapeHtml(item.acquisitionDate || '')}" /></td>
    <td><input data-official-item-field="remarks" value="${escapeHtml(item.remarks || item.notes || '')}" /></td>
    <td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td>
  </tr>`;
}

function renderOfficialAmmoEditableTable(title, kind, items) {
  return `
    <section class="official-editable-materials">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-wrap"><table><thead><tr><th>Αρ. Μερίδας</th><th>Περιγραφή</th><th>Ποσότητα</th><th></th></tr></thead>
      <tbody data-official-ammo-items="${kind}">${items.map((item) => renderOfficialAmmoEditableRow(item)).join('')}</tbody></table></div>
      <button class="secondary-button" data-add-official-ammo="${kind}" type="button">+ Προσθήκη Υλικού</button>
    </section>
  `;
}

function renderOfficialAmmoEditableRow(item = {}) {
  return `<tr><td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td><td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /><input data-official-item-field="nomenclatureNumber" type="hidden" value="${escapeHtml(item.nomenclatureNumber || '')}" /><input data-official-item-field="unit" type="hidden" value="${escapeHtml(item.unit || '')}" /></td><td><input data-official-item-field="quantity" type="number" step="0.001" value="${escapeHtml(item.quantity ?? '')}" /></td><td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td></tr>`;
}

function normalizeOfficialAmmoItems(data, kind) {
  const source = data[`${kind}Items`] || data.items?.filter((item) => item.itemType === kind) || [];
  return source.length ? source : [{}];
}

function bindOfficialExhpDataForm(form, type, showToast) {
  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-add-official-material]')) {
      const body = form.querySelector('[data-official-material-items]');
      body.insertAdjacentHTML('beforeend', renderOfficialEditableMaterialRow({}, body.querySelectorAll('tr').length));
      return;
    }
    if (event.target.closest('[data-add-useless-difference]')) {
      const body = form.querySelector('[data-official-material-items]');
      body.insertAdjacentHTML('beforeend', renderUselessDifferenceRow({}, body.querySelectorAll('tr').length));
      return;
    }
    const addAmmo = event.target.closest('[data-add-official-ammo]');
    if (addAmmo) {
      form.querySelector(`[data-official-ammo-items="${addAmmo.dataset.addOfficialAmmo}"]`)
        .insertAdjacentHTML('beforeend', renderOfficialAmmoEditableRow());
      return;
    }
    const remove = event.target.closest('[data-remove-official-material]');
    if (remove) {
      remove.closest('tr')?.remove();
      form.querySelectorAll('[data-official-row-number]').forEach((cell, index) => { cell.textContent = index + 1; });
    }
  });
  bindShareRows(form, 'official', showToast);
}

export function bindShareRows(root, prefix, showToast) {
  const getField = (row, name) => row.querySelector(`[data-${prefix}-item-field="${name}"]`);
  const getShareRows = () => [...root.querySelectorAll(`[data-${prefix}-item-field="shareNumber"]`)];
  const hasDuplicateShare = (shareInput) => {
    const value = shareInput.value.trim();
    if (!value) return false;
    return getShareRows().some((input) => input !== shareInput && input.value.trim() === value);
  };
  const clearDerivedFields = (row) => {
    row.dataset.availableQuantity = '';
    ['shareId', 'nomenclatureNumber', 'nominalNumber', 'description', 'unit', 'measurementUnit'].forEach((name) => {
      const input = getField(row, name);
      if (!input) return;
      input.value = '';
      input.readOnly = false;
      input.disabled = false;
      input.removeAttribute('title');
      input.removeAttribute('data-share-derived');
    });
  };
  const applyShareToRow = (row, share = {}) => {
    const shareId = getField(row, 'shareId');
    const nominal = getField(row, 'nomenclatureNumber') || getField(row, 'nominalNumber');
    const description = getField(row, 'description');
    const unit = getField(row, 'unit') || getField(row, 'measurementUnit');
    if (shareId) shareId.value = share.id || share.shareId || '';
    if (nominal) {
      nominal.value = share.nomenclatureNumber || share.nominalNumber || '';
      nominal.readOnly = true;
      nominal.disabled = true;
      nominal.title = 'Προέρχεται από την καρτέλα υλικού';
      nominal.dataset.shareDerived = 'true';
    }
    if (description) {
      description.value = share.description || '';
      description.readOnly = true;
      description.disabled = true;
      description.title = 'Προέρχεται από την καρτέλα υλικού';
      description.dataset.shareDerived = 'true';
    }
    if (unit) {
      unit.value = share.unit || share.measurementUnit || '';
      unit.readOnly = true;
      unit.disabled = true;
      unit.title = 'Προέρχεται από την καρτέλα υλικού';
      unit.dataset.shareDerived = 'true';
    }
    row.dataset.availableQuantity = String(
      share.quantity ?? share.availableQuantity ?? share.accountingBalance ?? ''
    );
  };
  const applySelectedShareOption = (shareInput) => {
    const option = shareInput.selectedOptions?.[0];
    if (!option || !option.value) return false;
    const row = shareInput.closest('tr');
    applyShareToRow(row, {
      id: option.dataset.shareId || '',
      shareId: option.dataset.shareId || '',
      nominalNumber: option.dataset.nominalNumber || '',
      nomenclatureNumber: option.dataset.nominalNumber || '',
      description: option.dataset.description || '',
      measurementUnit: option.dataset.measurementUnit || '',
      unit: option.dataset.measurementUnit || '',
      availableQuantity: option.dataset.availableQuantity || ''
    });
    return true;
  };
  const handleShareSelection = async (shareInput) => {
    if (!shareInput || !shareInput.value.trim()) {
      const row = shareInput?.closest('tr');
      if (row) clearDerivedFields(row);
      return;
    }
    const row = shareInput.closest('tr');
    if (hasDuplicateShare(shareInput)) {
      const duplicateLabel = shareInput.tagName === 'SELECT'
        ? (shareInput.selectedOptions?.[0]?.textContent || shareInput.value)
        : shareInput.value;
      shareInput.value = '';
      clearDerivedFields(row);
      showToast(`Η Μερίδα ${duplicateLabel} έχει ήδη προστεθεί στο δικαιολογητικό.`, 'error');
      return;
    }
    if (shareInput.tagName === 'SELECT' && applySelectedShareOption(shareInput)) return;
    try {
      const share = await window.appApi.shares.getShareByNumber(shareInput.value.trim());
      applyShareToRow(row, share);
    } catch (_error) {
      clearDerivedFields(row);
      showToast('Η μερίδα δεν βρέθηκε', 'error');
    }
  };
  root.addEventListener('focusout', async (event) => {
    const shareInput = event.target.closest(`[data-${prefix}-item-field="shareNumber"]`);
    if (!shareInput || shareInput.tagName === 'SELECT') return;
    await handleShareSelection(shareInput);
  });
  root.addEventListener('change', (event) => {
    const shareInput = event.target.closest(`[data-${prefix}-item-field="shareNumber"]`);
    if (shareInput) {
      handleShareSelection(shareInput);
      return;
    }
    const quantity = event.target.closest(
      `[data-${prefix}-item-field="quantity"], [data-${prefix}-item-field="qtyPrimary"], [data-${prefix}-item-field="qtySecondary"]`
    );
    if (!quantity) return;
    const available = Number(quantity.closest('tr').dataset.availableQuantity);
    if (!Number.isFinite(available) || !quantity.value) return;
    if (Number(quantity.value) > available) {
      showToast(`Η ποσότητα υπερβαίνει το διαθέσιμο υπόλοιπο της μερίδας (διαθέσιμο: ${available})`, 'error');
      quantity.value = '';
    }
  });
}

export function validateSharedMaterialPayload(payload, showToast) {
  payload.items = (payload.items || []).filter((item) => String(item.shareNumber || '').trim());
  if (payload.items.length) return true;
  showToast('Προσθέστε τουλάχιστον ένα υλικό με αριθμό μερίδας', 'error');
  return false;
}

function collectOfficialExhpDataForm(form, type) {
  const fields = Object.fromEntries([...form.querySelectorAll('[data-official-form-field]')].map((input) => [input.dataset.officialFormField, input.value]));
  if (type === 'useless_material_a') {
    return {
      location: fields.location || '', date: fields.date || '', hdmNumber: fields.hdmNumber || '',
      president: fields.president || '', memberA: fields.memberA || '', memberB: fields.memberB || '',
      periodFrom: fields.periodFrom || '', periodTo: fields.periodTo || '',
      items: collectOfficialFormRows(form, '[data-official-material-items] tr').map((item, index) => ({ aa: index + 1, ...item }))
    };
  }
  return {
    officerRank: fields.officerRank || '', officerName: fields.officerName || '', unit: fields.unit || '',
    firingDate: fields.firingDate || '', dayOfWeek: fields.dayOfWeek || '', copiesCount: readOptionalNumber(fields.copiesCount),
    items: [
      ...collectOfficialFormRows(form, '[data-official-ammo-items="consumed"] tr').map((item) => ({ ...item, itemType: 'consumed' })),
      ...collectOfficialFormRows(form, '[data-official-ammo-items="empty"] tr').map((item) => ({ ...item, itemType: 'empty' }))
    ]
  };
}

function collectOfficialFormRows(root, selector) {
  return [...root.querySelectorAll(selector)].map((row) => Object.fromEntries(
    [...row.querySelectorAll('[data-official-item-field]')].map((input) => [
      input.dataset.officialItemField,
      input.type === 'number' ? readOptionalNumber(input.value) : input.value.trim()
    ])
  )).filter((item) => Object.values(item).some((value) => value !== '' && value !== null));
}

export function openUselessMaterialFormModal(definition, exhp, data, settings, showToast, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop exhp-official-document-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">${escapeHtml(definition.group)}</p><h2>${escapeHtml(definition.label)}</h2></div>
        <div class="row-actions">
          <button class="secondary-button" data-close-useless-form type="button">Κλείσιμο</button>
          <button class="secondary-button" data-edit-useless-form type="button" hidden>← Επεξεργασία</button>
          <button class="secondary-button" data-save-useless-form type="button">Αποθήκευση</button>
          <button class="primary-button" data-preview-useless-form type="button">Προεπισκόπηση Εντύπου →</button>
          <button class="primary-button" data-print-useless-form type="button" hidden>Εκτύπωση</button>
        </div>
      </header>
      <div class="official-document-form-state no-print" data-useless-form>
        ${renderUselessMaterialDataForm(definition, data, settings)}
      </div>
      <div class="handover-document-preview" data-useless-preview hidden></div>
    </section>
  `;
  const form = modal.querySelector('[data-useless-form]');
  const preview = modal.querySelector('[data-useless-preview]');
  bindOfficialExhpDataForm(form, definition.kind === 'differences' ? 'differences' : 'statement', showToast);
  const setMode = (previewMode) => {
    form.hidden = previewMode;
    preview.hidden = !previewMode;
    modal.querySelector('[data-edit-useless-form]').hidden = !previewMode;
    modal.querySelector('[data-print-useless-form]').hidden = !previewMode;
    modal.querySelector('[data-preview-useless-form]').hidden = previewMode;
  };
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-useless-form]')) {
      modal.remove();
      return;
    }
    if (event.target.closest('[data-edit-useless-form]')) {
      setMode(false);
      return;
    }
    const payload = collectUselessMaterialDataForm(form, definition);
    if (event.target.closest('[data-preview-useless-form]')) {
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      preview.innerHTML = renderUselessMaterialPreview(definition, exhp, payload, settings);
      setMode(true);
      return;
    }
    if (event.target.closest('[data-print-useless-form]')) {
      await printExhpDocument(preview);
      return;
    }
    if (event.target.closest('[data-save-useless-form]')) {
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      try {
        const result = await onSave(payload);
        showToast(result?.message || 'Το έντυπο αποθηκεύτηκε.');
        modal.remove();
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του εντύπου.', 'error');
      }
    }
  });
  document.body.appendChild(modal);
}

function renderUselessMaterialDataForm(definition, data, settings) {
  const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];
  if (definition.kind === 'differences') {
    return `
      <section class="official-document-data-form">
        <div class="support-form-fields">
          ${officialDataField('Πρόεδρος', 'president', data.president)}
          ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
          ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
          ${officialDataField('Δκτής', 'commander', data.commander)}
          ${officialDataField('Γεν. Διαχειριστής', 'generalManager', data.generalManager)}
          ${officialDataField('Διαχειριστής Αχρήστου Υλικού', 'uselessManager', data.uselessManager)}
        </div>
        <section class="official-editable-materials"><div class="table-wrap"><table>
          <thead><tr><th>Α/Α</th><th>Αρ. Μερίδας</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσ. Πρωτοβάθμιας</th><th>Ποσ. Δευτεροβάθμιας</th><th>Διαφορά (+)</th><th>Διαφορά (-)</th><th></th></tr></thead>
          <tbody data-official-material-items>${items.map((item, index) => renderUselessDifferenceRow(item, index)).join('')}</tbody>
        </table></div><button class="secondary-button" data-add-useless-difference type="button">+ Προσθήκη Υλικού</button></section>
      </section>`;
  }
  return `
    <section class="official-document-data-form">
      <div class="support-form-fields">
        ${officialDataField('Τόπος', 'location', data.location || settings?.serviceInfo?.serviceLocation || '')}
        ${officialDataField('Ημερομηνία', 'date', data.date || '', 'date')}
        ${officialDataField('Αρ. ΗΔΜ', 'hdmNumber', data.hdmNumber)}
        ${officialDataField('Πρόεδρος', 'president', data.president)}
        ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
        ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
        ${officialDataField('Διαχειριστής Αχρήστου Υλικού', 'uselessManager', data.uselessManager)}
        ${officialDataField('Προϊστάμενος Λογιστηρίου', 'accountingHead', data.accountingHead)}
      </div>
      ${renderOfficialEditableMaterials(items)}
    </section>`;
}

function renderUselessDifferenceRow(item = {}, index = 0) {
  return `<tr><td data-official-row-number>${index + 1}</td>
    <td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td>
    <td><input data-official-item-field="nomenclatureNumber" value="${escapeHtml(item.nomenclatureNumber || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="unit" value="${escapeHtml(item.unit || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    ${['qtyPrimary', 'qtySecondary', 'diffPlus', 'diffMinus'].map((name) => `<td><input data-official-item-field="${name}" type="number" step="0.001" value="${escapeHtml(item[name] ?? '')}" /></td>`).join('')}
    <td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td></tr>`;
}

function collectUselessMaterialDataForm(form, definition) {
  const fields = Object.fromEntries([...form.querySelectorAll('[data-official-form-field]')].map((input) => [input.dataset.officialFormField, input.value]));
  const items = collectOfficialFormRows(form, '[data-official-material-items] tr');
  return { ...fields, items };
}

function renderUselessMaterialPreview(definition, exhp, payload, settings) {
  if (definition.kind === 'differences') {
    return renderOfficialUselessDifferencesProtocol(settings, exhp, payload);
  }
  if (definition.kind === 'inspection') {
    return renderOfficialUselessProtocol(settings, exhp, prepareUselessProtocolData(payload));
  }
  return renderClothingDisposalStatement(settings, exhp, {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      quantityWords: item.quantity === null || item.quantity === '' ? '' : numberToGreekWords(Number(item.quantity))
    }))
  }, definition.code, definition.title);
}

async function ensureOfficialExhpDocument(type, exhpId) {
  const documents = await window.appApi.exhpDocs.getByExhp(exhpId);
  const existing = documents.find((item) => item.documentType === type);
  if (existing) return existing;
  const result = await window.appApi.exhpDocs.create(exhpId, type);
  return result.document || result;
}

export function prepareUselessProtocolData(data) {
  const [year = '', month = '', day = ''] = String(data.date || '').slice(0, 10).split('-');
  const monthNames = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  return {
    ...data,
    day: data.day || day,
    month: data.month || monthNames[Number(month)] || month,
    year: data.year || year
  };
}

function officialExhpDocumentTitle(type) {
  return type === 'useless_material_a'
    ? 'ΕΦΕΔ 505 — Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού'
    : 'ΔΥΠ/192 — Πιστοποιητικό Καταναλώσεως Πυρομαχικών';
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

export function isUselessMaterialReason(value) {
  const normalized = normalizeForReason(value);
  return normalized.includes('λογιστικη τακτοποιηση') && normalized.includes('αχρηστου');
}

export function isAmmoConsumptionReason(value) {
  const normalized = normalizeForReason(value);
  return normalized.includes('διαγραφη') && normalized.includes('πυρομαχικων');
}

function normalizeForReason(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/αχρηστου|αχρηστου/g, 'αχρηστου');
}
