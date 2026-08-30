const PAGE_DRAFT_PREFIX = 'ui-page-draft:';
const SAVE_DELAY = 350;

export function createPageDraftController(draftsApi) {
  let active = null;
  let saveTimer = null;

  function storageKey(key) {
    return `${PAGE_DRAFT_PREFIX}${key}`;
  }

  function capture(delay = SAVE_DELAY) {
    if (!active?.root?.isConnected || active.restoring) return Promise.resolve();
    active.dirty = true;
    const snapshot = {
      data: { controls: collectControls(active.root) },
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(storageKey(active.key), JSON.stringify(snapshot));
    clearTimeout(saveTimer);
    if (delay > 0) {
      saveTimer = window.setTimeout(() => {
        draftsApi.save(storageKey(active.key), snapshot.data).catch((error) => {
          console.error('Αποτυχία αποθήκευσης πρόχειρης σελίδας:', error);
        });
      }, delay);
      return Promise.resolve();
    }
    return draftsApi.save(storageKey(active.key), snapshot.data).catch((error) => {
      console.error('Αποτυχία αποθήκευσης πρόχειρης σελίδας:', error);
    });
  }

  async function mount(key, root) {
    clearTimeout(saveTimer);
    active = key && root ? { key, root, dirty: false, restoring: true } : null;
    if (!active) return;
    let localDraft = null;
    try {
      localDraft = JSON.parse(window.localStorage.getItem(storageKey(key)) || 'null');
    } catch (_error) {
      window.localStorage.removeItem(storageKey(key));
    }
    if (localDraft?.data?.controls) restoreControls(root, localDraft.data.controls);
    active.restoring = false;
    let storedDraft = null;
    try {
      storedDraft = await draftsApi.get(storageKey(key));
    } catch (error) {
      console.error('Αποτυχία ανάκτησης πρόχειρης σελίδας:', error);
    }
    if (active?.key !== key || active.root !== root || !root.isConnected || active.dirty) return;
    const draft = newestDraft(localDraft, storedDraft);
    if (draft === storedDraft && draft?.data?.controls) {
      active.restoring = true;
      restoreControls(root, draft.data.controls);
      active.restoring = false;
    }
  }

  function deactivate() {
    const pending = capture(0);
    active = null;
    clearTimeout(saveTimer);
    return pending;
  }

  function handles(target) {
    return Boolean(active?.root?.contains(target));
  }

  return { capture, deactivate, handles, mount };
}

function newestDraft(localDraft, storedDraft) {
  if (!localDraft) return storedDraft;
  if (!storedDraft) return localDraft;
  return String(localDraft.updatedAt || '') >= String(storedDraft.updatedAt || '')
    ? localDraft
    : storedDraft;
}

function collectControls(root) {
  const occurrences = new Map();
  return editableControls(root).map((control) => {
    const signature = controlSignature(control);
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    return {
      signature,
      occurrence,
      value: control.type === 'checkbox' || control.type === 'radio'
        ? Boolean(control.checked)
        : control.multiple
          ? [...control.selectedOptions].map((option) => option.value)
          : control.value
    };
  });
}

function restoreControls(root, savedControls) {
  const available = new Map();
  const restored = [];
  editableControls(root).forEach((control) => {
    const signature = controlSignature(control);
    if (!available.has(signature)) available.set(signature, []);
    available.get(signature).push(control);
  });
  savedControls.forEach((saved) => {
    const control = available.get(saved.signature)?.[Number(saved.occurrence || 0)];
    if (!control) return;
    if (control.type === 'checkbox' || control.type === 'radio') {
      control.checked = Boolean(saved.value);
    } else if (control.multiple && Array.isArray(saved.value)) {
      [...control.options].forEach((option) => {
        option.selected = saved.value.includes(option.value);
      });
    } else {
      control.value = saved.value ?? '';
    }
    restored.push(control);
  });
  restored.forEach((control) => {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function editableControls(root) {
  return [...root.querySelectorAll('input, select, textarea')].filter((control) => {
    const type = String(control.type || '').toLowerCase();
    return !control.disabled && !control.readOnly && !['button', 'file', 'hidden', 'password', 'reset', 'submit'].includes(type)
      && !control.closest('[data-no-page-draft]');
  });
}

function controlSignature(control) {
  if (control.id) return `id:${control.id}`;
  if (control.name) return `name:${control.name}`;
  if (control.dataset.field) return `field:${control.dataset.field}`;
  if (control.dataset.filter) return `filter:${control.dataset.filter}`;
  return `${control.tagName.toLowerCase()}:${String(control.type || '')}`;
}
