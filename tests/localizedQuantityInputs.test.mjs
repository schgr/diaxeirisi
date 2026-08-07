import assert from 'node:assert/strict';

class FakeHTMLInputElement {
  constructor({ id = '', name = '', label = '', value = '', attributes = {} } = {}) {
    this.id = id;
    this.name = name;
    this.value = value;
    this.type = 'number';
    this.dataset = {};
    this.isConnected = true;
    this.attributes = Object.entries({ ...attributes, ...(name ? { name } : {}) })
      .map(([attributeName, attributeValue]) => ({ name: attributeName, value: attributeValue }));
    this.removedAttributes = [];
    this.label = label ? { textContent: label } : null;
  }

  getAttribute(attributeName) {
    return this.attributes.find((attribute) => attribute.name === attributeName)?.value ?? null;
  }

  removeAttribute(attributeName) {
    this.removedAttributes.push(attributeName);
  }

  closest(selector) {
    return selector === 'label' ? this.label : null;
  }
}

class FakeElement {
  constructor(inputs) {
    this.inputs = inputs;
  }

  querySelectorAll(selector) {
    return selector === 'input[data-localized-quantity="true"]'
      ? this.inputs.filter((input) => input.dataset.localizedQuantity === 'true')
      : this.inputs;
  }
}

const quantityInput = new FakeHTMLInputElement({ name: 'quantity', value: '99.25' });
const labelledInput = new FakeHTMLInputElement({ id: 'field-1', label: 'Ποσότητα παραλαβής', value: '1.5' });
const dataAttributeInput = new FakeHTMLInputElement({ id: 'field-2', attributes: { 'data-row-field': 'countedQuantity' } });
const unitPriceInput = new FakeHTMLInputElement({ name: 'unitPrice', value: '3.20' });
const registryInput = new FakeHTMLInputElement({ name: 'quantityRegistry', value: '4.5' });
const plainInput = new FakeHTMLInputElement({ name: 'description', value: 'κάτι' });
const inputs = [quantityInput, labelledInput, dataAttributeInput, unitPriceInput, registryInput, plainInput];

const listeners = new Map();
const observed = [];
let observerCallback;

globalThis.Element = FakeElement;
globalThis.HTMLInputElement = FakeHTMLInputElement;
globalThis.MutationObserver = class {
  constructor(callback) {
    observerCallback = callback;
  }

  observe(target, options) {
    observed.push([target, options]);
  }
};
globalThis.document = Object.assign(new FakeElement(inputs), {
  body: { tagName: 'BODY' },
  addEventListener(type, listener, capture) {
    listeners.set(type, { listener, capture });
  }
});

const { initializeLocalizedQuantities, machineToDisplay } = await import('../src/ui/localizedQuantities.js');

initializeLocalizedQuantities();

assert.deepEqual(observed, [[globalThis.document.body, { childList: true, subtree: true }]]);
assert.deepEqual([...listeners.keys()], ['focusin', 'input', 'change', 'click', 'submit']);
assert.equal(listeners.get('focusin').capture, true, 'listeners run in the capture phase');

assert.equal(quantityInput.dataset.localizedQuantity, 'true');
assert.equal(quantityInput.type, 'text');
assert.equal(quantityInput.inputMode, 'decimal');
assert.deepEqual(quantityInput.removedAttributes, ['min', 'max', 'step']);
assert.equal(quantityInput.value, '99,25', 'stored values are shown with a decimal comma');
assert.equal(labelledInput.value, '1,5', 'the label text identifies a quantity field');
assert.equal(dataAttributeInput.dataset.localizedQuantity, 'true', 'data attributes identify a quantity field');
assert.equal(unitPriceInput.dataset.localizedQuantity, undefined, 'unit prices keep the native number input');
assert.equal(unitPriceInput.value, '3.20');
assert.equal(registryInput.dataset.localizedQuantity, undefined, 'registry counters are excluded');
assert.equal(plainInput.dataset.localizedQuantity, undefined);

const addedInput = new FakeHTMLInputElement({ name: 'quantity', value: '7.5' });
observerCallback([{ addedNodes: [new FakeElement([addedInput]), 'κείμενο'] }]);
assert.equal(addedInput.value, '7,5', 'inputs added later are prepared by the observer');

listeners.get('input').listener({ target: quantityInput });
assert.equal(quantityInput.value, '99.25', 'the machine value is exposed synchronously to the application');
await Promise.resolve();
assert.equal(quantityInput.value, '99,25', 'the display value is restored after the event loop turn');

quantityInput.value = '1.2,34';
listeners.get('input').listener({ target: quantityInput });
assert.equal(quantityInput.value, '12.34', 'typed thousand separators are dropped');
await Promise.resolve();
assert.equal(quantityInput.value, '12,34');

listeners.get('input').listener({ target: plainInput });
assert.equal(plainInput.value, 'κάτι', 'non quantity inputs are left untouched');

const focusInput = new FakeHTMLInputElement({ name: 'quantity', value: '5.5' });
listeners.get('focusin').listener({ target: focusInput });
assert.equal(focusInput.value, '5,5');
listeners.get('focusin').listener({ target: { value: 'not an input' } });

const disconnected = new FakeHTMLInputElement({ name: 'quantity', value: '2.5' });
disconnected.dataset.localizedQuantity = 'true';
inputs.push(disconnected);
listeners.get('submit').listener();
disconnected.isConnected = false;
assert.equal(quantityInput.value, '12.34', 'submitted forms read machine values');
await Promise.resolve();
assert.equal(quantityInput.value, '12,34');
assert.equal(disconnected.value, '2.5', 'inputs removed while handling the event are not restored');

assert.equal(machineToDisplay(null), '');

console.log('localizedQuantityInputs.test.mjs: OK');
