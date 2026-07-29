const QUANTITY_PATTERN = /quantity|ποσ[οό]τητα|count|καταμ[εέ]τρ/iu;
const EXCLUDED_PATTERN = /unit[-_ ]?price|registry|sort|display[-_ ]?count/iu;

function isQuantityInput(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  const label = input.closest('label')?.textContent || '';
  const attributes = [
    input.id,
    input.name,
    input.getAttribute('aria-label'),
    ...Array.from(input.attributes)
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => `${attribute.name} ${attribute.value}`)
  ].join(' ');
  const searchable = `${attributes} ${label}`;
  return QUANTITY_PATTERN.test(searchable) && !EXCLUDED_PATTERN.test(searchable);
}

export function machineToDisplay(value) {
  return String(value ?? '').replace('.', ',');
}

export function sanitizeTypedQuantity(value) {
  const cleaned = String(value ?? '').replace(/\./g, '').replace(/[^\d,]/g, '');
  const [integer = '', ...decimals] = cleaned.split(',');
  return decimals.length ? `${integer},${decimals.join('')}` : integer;
}

export function displayToMachine(value) {
  return String(value ?? '').replace(',', '.');
}

function prepareQuantityInput(input) {
  if (!isQuantityInput(input) || input.dataset.localizedQuantity === 'true') return;
  input.dataset.localizedQuantity = 'true';
  input.type = 'text';
  input.inputMode = 'decimal';
  input.removeAttribute('min');
  input.removeAttribute('max');
  input.removeAttribute('step');
  input.value = machineToDisplay(input.value);
}

function prepareTree(root) {
  if (root instanceof HTMLInputElement) prepareQuantityInput(root);
  root.querySelectorAll?.('input').forEach(prepareQuantityInput);
}

function useMachineValuesForEvent() {
  const inputs = Array.from(document.querySelectorAll('input[data-localized-quantity="true"]'));
  const displayValues = inputs.map((input) => input.value);
  inputs.forEach((input) => {
    input.value = displayToMachine(input.value);
  });
  queueMicrotask(() => {
    inputs.forEach((input, index) => {
      if (input.isConnected) input.value = displayValues[index];
    });
  });
}

export function initializeLocalizedQuantities() {
  prepareTree(document);

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareTree(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    prepareQuantityInput(input);
    if (input.dataset.localizedQuantity === 'true') input.value = machineToDisplay(input.value);
  }, true);

  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.localizedQuantity !== 'true') return;
    const displayValue = sanitizeTypedQuantity(input.value);
    input.value = displayToMachine(displayValue);
    queueMicrotask(() => {
      if (input.isConnected) input.value = displayValue;
    });
  }, true);

  for (const eventName of ['change', 'click', 'submit']) {
    document.addEventListener(eventName, useMachineValuesForEvent, true);
  }
}
