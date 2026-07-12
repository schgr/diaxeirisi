import { escapeHtml, field, getFormData } from '../components/forms.js';
import { requestPriorityColumns, requestPriorityRows } from '../requestPriorities.js';

const materialCategorySection = {
  key: 'material-category',
  title: 'Κατηγορία Υλικού',
  inputLabel: 'Νέα κατηγορία',
  itemsKey: 'materialCategories',
  addMethod: 'addMaterialCategory',
  deleteMethod: 'deleteMaterialCategory',
  addMessage: 'Η κατηγορία υλικού προστέθηκε.',
  deleteMessage: 'Η κατηγορία υλικού διαγράφηκε.'
};

export async function renderSettingsPage(container, settingsApi, clothingApi, showToast) {
  const settings = await settingsApi.get();

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΡΥΘΜΙΣΕΙΣ</p>
        <h2>Βασικά στοιχεία εφαρμογής</h2>
      </div>
    </section>

    <nav class="transaction-flow-home contextual-tile-menu settings-tile-menu" data-settings-menu aria-label="Ενότητες ρυθμίσεων">
      <button class="home-tile transaction-flow-tile" data-settings-tab="general" type="button"><span class="home-tile-icon">ΓΕ</span><span class="home-tile-title">Γενικά</span><span class="home-tile-code">§ ΡΥ-Α</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="personnel" type="button"><span class="home-tile-icon">ΠΡ</span><span class="home-tile-title">Προσωπικό</span><span class="home-tile-code">§ ΡΥ-Β</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="parameters" type="button"><span class="home-tile-icon">ΠΑ</span><span class="home-tile-title">Παράμετροι</span><span class="home-tile-code">§ ΡΥ-Γ</span></button>
    </nav>
    <div class="transaction-tab-panel" data-settings-panel="general" hidden>
      <div class="settings-layout">
        <section class="page-panel">
          <h3>Στοιχεία Υπηρεσίας</h3>
          <form id="service-form" class="stacked-form autosave-form">
            ${field('Στρατιωτική Υπηρεσία', 'serviceName', settings.serviceInfo.serviceName, 'π.χ. 1ο Τμήμα')}
            ${field('Τοποθεσία Στρατιωτικής Υπηρεσίας', 'serviceLocation', settings.serviceInfo.serviceLocation, 'π.χ. Αθήνα')}
            ${field('ΤΥΠΟΣ ΔΙΑΧΕΙΡΙΣΗΣ', 'managementType', settings.serviceInfo.managementType, 'π.χ. Γενική Διαχείριση Υλικού', 'data-preserve-case="true"')}
          </form>
        </section>

        <section class="page-panel">
          <h3>Οικονομικά Όργανα</h3>
          <form id="officers-form" class="stacked-form autosave-form">
            ${field('ΔΚΤΗΣ', 'commander', settings.financialOfficers.commander, '', 'data-preserve-case="true"')}
            ${field('Π.Ε.Δ', 'ped', settings.financialOfficers.ped, '', 'data-preserve-case="true"')}
            ${field('ΔΧΣΤΗΣ', 'manager', settings.financialOfficers.manager, '', 'data-preserve-case="true"')}
          </form>
        </section>
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="personnel" hidden>
      <div class="settings-layout">
        <section class="page-panel wide-panel">
          <h3>Μερικοί Διαχειριστές</h3>
          ${renderDepartmentManagerTable(settings.departmentManagers)}
          <form id="department-form" class="inline-form">
            ${field('Τμήμα Μονάδος', 'departmentName')}
            ${field('Επικεφαλής Τμήματος', 'departmentHead', '', '', 'data-preserve-case="true"')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="parameters" hidden>
      <div class="settings-layout">
        <section class="page-panel">
          <h3>Μονάδες Μέτρησης</h3>
          ${renderMeasurementUnitTable(settings.measurementUnits)}
          <form id="measurement-unit-form" class="inline-form">
            ${field('Περιγραφή', 'name')}
            ${field('Αγγλική ορολογία', 'code')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>

        <section class="page-panel">
          <h3>${materialCategorySection.title}</h3>
          ${renderNamedList(materialCategorySection.key, settings[materialCategorySection.itemsKey])}
          <form id="${materialCategorySection.key}-form" class="inline-form compact-form">
            ${field(materialCategorySection.inputLabel, 'name')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>

        <section class="page-panel">
          <h3>Μονάδες Δοσοληψιών</h3>
          ${renderNamedList('transaction-unit', settings.transactionUnits)}
          <form id="transaction-unit-form" class="inline-form compact-form">
            ${field('Νέα μονάδα δοσοληψιών', 'name')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>
      </div>
    </div>
  `;

  bindSettingsTabs(container);
  bindSettingsEvents(container, settingsApi, clothingApi, showToast);
}

function renderClothingItemsSection(items) {
  return `
    <h3>ΕΙΔΗ ΙΜΑΤΙΣΜΟΥ</h3>
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>Α/Α</th>
            <th>Περιγραφή</th>
            <th>Σύντομη</th>
            <th>Κατηγορία</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.length
            ? items.map((item, index) => `
                <tr data-clothing-item-id="${item.id}">
                  <td>${index + 1}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.shortName || '')}</td>
                  <td>${escapeHtml(clothingCategoryLabel(item.category))}</td>
                  <td class="row-actions">
                    <button class="secondary-button" data-move-clothing="-1" type="button" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="secondary-button" data-move-clothing="1" type="button" ${index === items.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="danger-button" data-delete-clothing type="button" title="Διαγραφή">Δ</button>
                  </td>
                </tr>
              `).join('')
            : '<tr><td colspan="5" class="empty-table">Δεν υπάρχουν είδη ιματισμού.</td></tr>'}
        </tbody>
      </table>
    </div>
    <form id="clothing-item-form" class="inline-form">
      ${field('Περιγραφή', 'name', '', '', 'required')}
      ${field('Σύντομη', 'shortName')}
      <label class="field">
        <span>Κατηγορία</span>
        <select name="category" required>
          <option value="">Επιλογή</option>
          <option value="ιματισμός">Ιματισμός</option>
          <option value="υπόδηση">Υπόδηση</option>
          <option value="ατομικά">Ατομικά</option>
        </select>
      </label>
      ${field('Σειρά', 'sortOrder', String(items.length + 1), '', 'type="number" min="0" step="1" required')}
      <button class="primary-button" type="submit">Προσθήκη</button>
    </form>
  `;
}

function clothingCategoryLabel(category) {
  return {
    'ιματισμός': 'Ιματισμός',
    'υπόδηση': 'Υπόδηση',
    'ατομικά': 'Ατομικά'
  }[category] || category;
}

function bindSettingsTabs(container) {
  const menu = container.querySelector('[data-settings-menu]');
  container.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.settingsTab;
      menu.querySelectorAll('[data-settings-tab]').forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      container.querySelectorAll('[data-settings-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.settingsPanel !== tab;
      });
    });
  });
}

export function renderRequestPriorityTable() {
  return `
    <div class="table-wrap request-codes-wrap">
      <table class="settings-priority-table">
        <thead>
          <tr>
            <th>Επείγον Ανάγκης</th>
            <th>Σπουδαιότητα Μονάδων</th>
            ${requestPriorityColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
          </tr>
          <tr>
            <th></th>
            <th>Προτεραιότητα Σχηματισμού</th>
            ${requestPriorityColumns
              .map((column) => `<th>${escapeHtml(column.formation).replace(/\n/g, '<br />')}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${requestPriorityRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.urgency)}</td>
                  <td>${escapeHtml(row.description)}</td>
                  ${row.codes.map((code) => `<td>${escapeHtml(code)}</td>`).join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMeasurementUnitTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν μονάδες μέτρησης.</p>';
  }

  return `
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>Περιγραφή</th>
            <th>Αγγλική ορολογία</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr data-id="${item.id}" data-kind="measurement-unit">
                  <td><input class="locked-input" data-field="name" value="${escapeHtml(item.name)}" readonly /></td>
                  <td><input class="locked-input" data-field="code" value="${escapeHtml(item.code || '')}" readonly /></td>
                  <td class="row-actions">
                    <button class="danger-button" data-action="delete-measurement-unit" type="button">Διαγραφή</button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderRequestCodeTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν έχουν καταχωρηθεί κωδικοί αιτήσεων.</p>';
  }

  return `
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>α/α</th>
            <th>Κωδικός Αιτιολογίας</th>
            <th>Περιγραφή Κωδικού Αιτιολογίας</th>
            <th>Αυτόματη Διαγραφή Οφειλομένων</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="strong-cell">${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${item.autoDeleteOwed ? 'ΝΑΙ' : 'ΟΧΙ'}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDepartmentManagerTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν έχουν προστεθεί μερικοί διαχειριστές.</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Τμήμα Μονάδος</th>
            <th>Επικεφαλής Τμήματος</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr data-id="${item.id}" data-kind="department-manager">
                  <td><input class="locked-input" data-field="departmentName" value="${escapeHtml(item.departmentName)}" readonly /></td>
                  <td><input class="locked-input" data-field="departmentHead" data-preserve-case="true" value="${escapeHtml(item.departmentHead)}" readonly /></td>
                  <td class="row-actions">
                    <button class="danger-button" data-action="delete-department" type="button">Διαγραφή</button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderNamedList(kind, items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν εγγραφές.</p>';
  }

  return `
    <div class="item-list">
      ${items
        .map(
          (item) => `
            <div class="list-row no-save-row" data-id="${item.id}" data-kind="${kind}">
              <input class="locked-input" data-field="name" value="${escapeHtml(item.name)}" readonly />
              <button class="danger-button" data-action="delete-${kind}" type="button">Διαγραφή</button>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderExhpIssueReasonSettings(items, selectedReasonName = '') {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν αιτιολογίες εκδόσεως.</p>';
  }

  const selectedItem = items.find((item) => item.name === selectedReasonName) || items[0];

  return `
    <div class="exhp-reason-settings">
      <label class="field">
        <span>Αιτιολογία Εκδόσεως</span>
        <select id="exhp-reason-settings-select">
          ${items.map((item) => `
            <option value="${item.id}" ${item.id === selectedItem.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>
          `).join('')}
        </select>
      </label>
      <article class="exhp-reason-setting" data-exhp-reason-setting="${selectedItem.id}">
        <label class="field">
          <span>Εισήγηση</span>
          <textarea data-field="recommendationText" rows="3">${escapeHtml(selectedItem.recommendationText || '')}</textarea>
        </label>
        <label class="field">
          <span>Γνωμάτευση 1η</span>
          <textarea data-field="firstOpinionText" rows="3">${escapeHtml(selectedItem.firstOpinionText || '')}</textarea>
        </label>
        <label class="field">
          <span>Γνωμάτευση 2η</span>
          <textarea data-field="secondOpinionText" rows="3">${escapeHtml(selectedItem.secondOpinionText || '')}</textarea>
        </label>
        <div class="row-actions">
          <button class="primary-button" data-save-exhp-reason-texts type="button">Αποθήκευση Κειμένων</button>
        </div>
      </article>
    </div>
  `;
}

export function syncExhpIssueReasonSettings(container, items, selectedReasonName) {
  if (!items.length) return;

  const selectedItem = items.find((item) => item.name === selectedReasonName) || items[0];
  const select = container.querySelector('#exhp-reason-settings-select');
  const row = container.querySelector('[data-exhp-reason-setting]');
  if (!select || !row) return;

  select.value = String(selectedItem.id);
  row.dataset.exhpReasonSetting = String(selectedItem.id);
  row.querySelector('[data-field="recommendationText"]').value = selectedItem.recommendationText || '';
  row.querySelector('[data-field="firstOpinionText"]').value = selectedItem.firstOpinionText || '';
  row.querySelector('[data-field="secondOpinionText"]').value = selectedItem.secondOpinionText || '';
}

function bindSettingsEvents(container, settingsApi, clothingApi, showToast) {
  bindAutosaveForm(container, '#service-form', showToast, async (form) => {
    await settingsApi.saveServiceInfo(getFormData(form));
  });

  bindAutosaveForm(container, '#officers-form', showToast, async (form) => {
    await settingsApi.saveFinancialOfficers(getFormData(form));
  });

  bindForm(container, '#department-form', showToast, async (form) => {
    await settingsApi.addDepartmentManager(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Ο μερικός διαχειριστής προστέθηκε.');
  });

  bindForm(container, `#${materialCategorySection.key}-form`, showToast, async (form) => {
    await settingsApi[materialCategorySection.addMethod](getFormData(form));
    await refresh(container, settingsApi, showToast, materialCategorySection.addMessage);
  });

  bindForm(container, '#measurement-unit-form', showToast, async (form) => {
    await settingsApi.addMeasurementUnit(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Η μονάδα μέτρησης προστέθηκε.');
  });

  bindForm(container, '#transaction-unit-form', showToast, async (form) => {
    await settingsApi.addTransactionUnit(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Η μονάδα δοσοληψιών προστέθηκε.');
  });

  bindDeletes(container, settingsApi, showToast);
}

function bindClothingSettings(container, clothingApi, showToast, initialItems) {
  const section = container.querySelector('#clothing-items-section');
  let items = initialItems;

  const bindAddForm = () => {
    const form = section.querySelector('#clothing-item-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await clothingApi.addItem(getFormData(form));
        await refreshSection();
        showToast('Το είδος ιματισμού προστέθηκε.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η προσθήκη του είδους ιματισμού.', 'error');
      }
    });
  };

  const refreshSection = async () => {
    items = await clothingApi.getItems();
    section.innerHTML = renderClothingItemsSection(items);
    bindAddForm();
  };

  bindAddForm();
  section.addEventListener('click', async (event) => {
    const row = event.target.closest('[data-clothing-item-id]');
    if (!row) return;
    const itemId = Number(row.dataset.clothingItemId);
    const itemIndex = items.findIndex((item) => item.id === itemId);

    if (event.target.closest('[data-delete-clothing]')) {
      if (!window.confirm('Να διαγραφεί το είδος ιματισμού;')) return;
      try {
        await clothingApi.deleteItem(itemId);
        await refreshSection();
        showToast('Το είδος ιματισμού διαγράφηκε.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή του είδους ιματισμού.', 'error');
      }
      return;
    }

    const moveButton = event.target.closest('[data-move-clothing]');
    if (!moveButton) return;
    const targetIndex = itemIndex + Number(moveButton.dataset.moveClothing);
    if (itemIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    try {
      const current = items[itemIndex];
      const target = items[targetIndex];
      await clothingApi.updateItem(current.id, clothingItemUpdatePayload(current, target.sortOrder));
      await clothingApi.updateItem(target.id, clothingItemUpdatePayload(target, current.sortOrder));
      await refreshSection();
      showToast('Η σειρά των ειδών ιματισμού ενημερώθηκε.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αλλαγή σειράς.', 'error');
    }
  });
}

function clothingItemUpdatePayload(item, sortOrder) {
  return {
    name: item.name,
    shortName: item.shortName,
    category: item.category,
    sortOrder
  };
}

function bindDeletes(container, settingsApi, showToast) {
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const row = button.closest('[data-id]');
    const id = Number(row.dataset.id);
    const action = button.dataset.action;

    try {
      if (action === 'delete-department') {
        await settingsApi.deleteDepartmentManager(id);
        await refresh(container, settingsApi, showToast, 'Η εγγραφή διαγράφηκε.');
        return;
      }

      if (action === 'delete-measurement-unit') {
        await settingsApi.deleteMeasurementUnit(id);
        await refresh(container, settingsApi, showToast, 'Η μονάδα μέτρησης διαγράφηκε.');
        return;
      }

      if (action === `delete-${materialCategorySection.key}`) {
        await settingsApi[materialCategorySection.deleteMethod](id);
        await refresh(container, settingsApi, showToast, materialCategorySection.deleteMessage);
        return;
      }

      if (action === 'delete-transaction-unit') {
        await settingsApi.deleteTransactionUnit(id);
        await refresh(container, settingsApi, showToast, 'Η μονάδα δοσοληψιών διαγράφηκε.');
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  });
}

export function bindRequestSettings(container, settingsApi, showToast, rerender) {
  bindForm(container, '#request-issuing-unit-form', showToast, async (form) => {
    await settingsApi.addRequestIssuingUnit(getFormData(form));
    await refreshMovedSettings(container, rerender, showToast, 'Η μονάδα χορήγησης προστέθηκε.');
  });

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="delete-request-issuing-unit"]');
    if (!button) return;
    try {
      await settingsApi.deleteRequestIssuingUnit(Number(button.closest('[data-id]').dataset.id));
      await refreshMovedSettings(container, rerender, showToast, 'Η μονάδα χορήγησης διαγράφηκε.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  });
}

export function bindTransactionSettings(container, settingsApi, exhpIssueReasons, showToast, rerender) {
  bindForm(container, '#transaction-unit-form', showToast, async (form) => {
    await settingsApi.addTransactionUnit(getFormData(form));
    await refreshMovedSettings(container, () => rerender('addy'), showToast, 'Η μονάδα δοσοληψιών προστέθηκε.');
  });

  bindForm(container, '#exhp-issue-reason-form', showToast, async (form) => {
    await settingsApi.addExhpIssueReason(getFormData(form));
    await refreshMovedSettings(container, () => rerender('exhp'), showToast, 'Η αιτιολογία εκδόσεως προστέθηκε.');
  });

  container.querySelector('#exhp-reason-settings-select')?.addEventListener('change', (event) => {
    const selectedItem = exhpIssueReasons.find((item) => item.id === Number(event.target.value));
    syncExhpIssueReasonSettings(container, exhpIssueReasons, selectedItem?.name);
  });

  container.addEventListener('click', async (event) => {
    const saveTexts = event.target.closest('[data-save-exhp-reason-texts]');
    if (saveTexts) {
      const row = saveTexts.closest('[data-exhp-reason-setting]');
      try {
        await settingsApi.updateExhpIssueReasonTexts(
          Number(row.dataset.exhpReasonSetting),
          Object.fromEntries(
            [...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value])
          )
        );
        showToast('Τα κείμενα της ΕΧΠ αποθηκεύτηκαν.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση των κειμένων.', 'error');
      }
      return;
    }

    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.closest('[data-id]').dataset.id);
    try {
      if (button.dataset.action === 'delete-transaction-unit') {
        await settingsApi.deleteTransactionUnit(id);
        await refreshMovedSettings(container, () => rerender('addy'), showToast, 'Η μονάδα δοσοληψιών διαγράφηκε.');
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  });
}

function bindAutosaveForm(container, selector, showToast, onSave) {
  const form = container.querySelector(selector);
  const save = debounce(async () => {
    await onSave(form);
    showToast('Η αλλαγή αποθηκεύτηκε αυτόματα.');
  }, 700, showToast);

  form.addEventListener('submit', (event) => event.preventDefault());

  for (const input of form.querySelectorAll('input')) {
    input.addEventListener('input', save);
    input.addEventListener('blur', save);
  }
}

function bindForm(container, selector, showToast, onSubmit) {
  const form = container.querySelector(selector);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await onSubmit(form);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η προσθήκη.', 'error');
    }
  });
}

function debounce(operation, delay, showToast) {
  let timeoutId;

  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(async () => {
      try {
        await operation();
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αυτόματη αποθήκευση.', 'error');
      }
    }, delay);
  };
}

async function refresh(container, settingsApi, showToast, message) {
  await renderSettingsPage(container, settingsApi, window.appApi.clothing, showToast);
  const content = container.closest('.content');
  if (content) content.scrollTop = 0;
  showToast(message);
}

async function refreshMovedSettings(container, rerender, showToast, message) {
  await rerender();
  const content = container.closest('.content');
  if (content) content.scrollTop = 0;
  showToast(message);
}
