const React = require('react');
const ReactDOMServer = require('react-dom/server');
const assert = require('assert');

const {
  StatusBadge,
  ThresholdControl,
  ReplenishmentOrderModal
} = require('../src/components/InventoryComponents');
const {
  InventoryManagerView,
  INITIAL_INVENTORY
} = require('../src/InventoryManagerView');

console.log('--- React Component & State Design Test Suite: Inventory Manager ---\n');

let passedTests = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✔ Passed: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✖ Failed: ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// 1. Reusable Component 1: StatusBadge calculations
test('StatusBadge renders Critical Low, Reorder Needed, and Healthy based on thresholds', () => {
  const critical = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StatusBadge, { currentStock: 3, lowThreshold: 5, reorderPoint: 15 })
  );
  assert.ok(critical.includes('Critical Low'), 'Should render Critical Low when stock <= lowThreshold');

  const reorder = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StatusBadge, { currentStock: 10, lowThreshold: 5, reorderPoint: 15 })
  );
  assert.ok(reorder.includes('Reorder Needed'), 'Should render Reorder Needed when stock <= reorderPoint');

  const healthy = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StatusBadge, { currentStock: 25, lowThreshold: 5, reorderPoint: 15 })
  );
  assert.ok(healthy.includes('Healthy'), 'Should render Healthy when stock > reorderPoint');
});

// 2. Reusable Component 2: ThresholdControl buttons and label
test('ThresholdControl renders label, min threshold check, and decrement/increment buttons', () => {
  let changedVal = null;
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ThresholdControl, {
      label: 'Safety Stock',
      value: 12,
      min: 0,
      onChange: (v) => { changedVal = v; }
    })
  );
  assert.ok(markup.includes('Safety Stock:'), 'Should render label');
  assert.ok(markup.includes('12'), 'Should render current value');
  assert.ok(markup.includes('-'), 'Should render decrement button');
  assert.ok(markup.includes('+'), 'Should render increment button');
});

// 3. Reusable Component 3: ReplenishmentOrderModal open & close states
test('ReplenishmentOrderModal renders null when closed and renders details when open', () => {
  const closedMarkup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReplenishmentOrderModal, {
      item: INITIAL_INVENTORY[0],
      isOpen: false,
      onClose: () => {},
      onConfirm: () => {}
    })
  );
  assert.strictEqual(closedMarkup, '', 'Closed modal should return empty output');

  const openMarkup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ReplenishmentOrderModal, {
      item: INITIAL_INVENTORY[0],
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {}
    })
  );
  assert.ok(openMarkup.includes('Create Supplier Replenishment Order'), 'Should contain modal title');
  assert.ok(openMarkup.includes('Precision Parts Corp'), 'Should display supplier name');
  assert.ok(openMarkup.includes('Standard Freight'), 'Should display default shipping options');
});

// 4. View State: Loading State
test('InventoryManagerView renders designated Loading State', () => {
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(InventoryManagerView, {
      initialLoading: true,
      initialItems: null
    })
  );
  assert.ok(markup.includes('data-testid="loading-state"'), 'Should display loading container');
  assert.ok(markup.includes('Loading Stock Catalog...'), 'Should display loading message');
  assert.ok(!markup.includes('data-testid="inventory-table"'), 'Table should not render during loading');
});

// 5. View State: Error State with retry button
test('InventoryManagerView renders designated Error State with message and retry trigger', () => {
  const errorMsg = 'Supplier Network Outage (503): Cannot retrieve stock counts.';
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(InventoryManagerView, {
      initialLoading: false,
      initialItems: null,
      initialError: errorMsg
    })
  );
  assert.ok(markup.includes('data-testid="error-state"'), 'Should display error container');
  assert.ok(markup.includes(errorMsg), 'Should display explicit error message');
  assert.ok(markup.includes('Retry Supplier Sync'), 'Should display retry button');
  assert.ok(!markup.includes('data-testid="inventory-table"'), 'Table should not render during error');
});

// 6. View State: Empty State
test('InventoryManagerView renders designated Empty State when items array is empty', () => {
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(InventoryManagerView, {
      initialLoading: false,
      initialItems: [],
      initialError: null
    })
  );
  assert.ok(markup.includes('data-testid="empty-state"'), 'Should display empty container');
  assert.ok(markup.includes('No Inventory Items Found'), 'Should display empty message');
  assert.ok(!markup.includes('data-testid="inventory-table"'), 'Table should not render when empty');
});

// 7. View State: Populated Data Table State
test('InventoryManagerView renders populated inventory items with supplier details', () => {
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(InventoryManagerView, {
      initialLoading: false,
      initialItems: INITIAL_INVENTORY,
      initialError: null
    })
  );
  assert.ok(markup.includes('data-testid="inventory-table"'), 'Should display table');
  assert.ok(markup.includes('SKU-BRG-01'), 'Should display SKU for first item');
  assert.ok(markup.includes('Industrial Roller Bearing'), 'Should display item name');
  assert.ok(markup.includes('Order Replenishment'), 'Should display replenishment action buttons');
});

console.log(`\nResults: ${passedTests} test scenarios executed and passed successfully!`);
