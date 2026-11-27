const React = require('react');
const {
  StatusBadge,
  ThresholdControl,
  ReplenishmentOrderModal
} = require('./components/InventoryComponents');

// Initial Mock Inventory Data
const INITIAL_INVENTORY = [
  {
    id: 'item-101',
    sku: 'SKU-BRG-01',
    name: 'Industrial Roller Bearing',
    category: 'Mechanical',
    currentStock: 4,
    lowThreshold: 10,
    reorderPoint: 25,
    supplier: 'Precision Parts Corp',
    supplierLeadDays: 4,
    unitCost: 18.50,
    pendingOrder: null
  },
  {
    id: 'item-102',
    sku: 'SKU-FLT-09',
    name: 'Air Intake Pleated Filter',
    category: 'HVAC & Filtration',
    currentStock: 14,
    lowThreshold: 12,
    reorderPoint: 30,
    supplier: 'Apex Clean Air Ltd',
    supplierLeadDays: 6,
    unitCost: 9.75,
    pendingOrder: null
  },
  {
    id: 'item-103',
    sku: 'SKU-SNS-44',
    name: 'Thermal Probe Sensor 100K',
    category: 'Sensors & Electrical',
    currentStock: 68,
    lowThreshold: 15,
    reorderPoint: 35,
    supplier: 'Sens-Tech Global',
    supplierLeadDays: 3,
    unitCost: 32.00,
    pendingOrder: null
  }
];

function InventoryManagerView({
  initialItems = null,
  initialLoading = false,
  initialError = null,
  fetchFn = null
}) {
  // Top-level Application State
  const [items, setItems] = React.useState(initialItems);
  const [isLoading, setIsLoading] = React.useState(initialLoading);
  const [errorMessage, setErrorMessage] = React.useState(initialError);
  const [filterThresholdOnly, setFilterThresholdOnly] = React.useState(false);
  const [selectedReplenishItem, setSelectedReplenishItem] = React.useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = React.useState(false);
  const [notification, setNotification] = React.useState(null);

  // Load data hook/function
  const loadInventory = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (fetchFn) {
        const data = await fetchFn();
        setItems(data);
      } else {
        // Fallback default fixture
        setItems(INITIAL_INVENTORY);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to fetch inventory data from supplier network.');
      setItems(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  React.useEffect(() => {
    if (initialItems === null && !initialLoading && !initialError) {
      loadInventory();
    }
  }, [loadInventory, initialItems, initialLoading, initialError]);

  // Handlers for adjusting threshold and stock
  const handleUpdateThreshold = (itemId, newLowThreshold) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, lowThreshold: newLowThreshold } : item))
    );
  };

  const handleUpdateStock = (itemId, newStock) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, currentStock: newStock } : item))
    );
  };

  // Handler for confirming supplier purchase order
  const handleConfirmReplenishment = async (orderDetails) => {
    setIsSubmittingOrder(true);
    try {
      // Simulate API round-trip to supplier ERP
      await new Promise((resolve) => setTimeout(resolve, 300));

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === orderDetails.itemId) {
            return {
              ...item,
              pendingOrder: {
                quantity: orderDetails.quantity,
                supplier: orderDetails.supplier,
                placedAt: new Date().toISOString(),
                totalCost: orderDetails.totalCost
              }
            };
          }
          return item;
        })
      );

      setNotification(`Replenishment PO placed: ${orderDetails.quantity} units for SKU with ${orderDetails.supplier}.`);
      setSelectedReplenishItem(null);
    } catch {
      setErrorMessage('Failed to submit purchase order to supplier.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Filtered view logic
  const displayedItems = (items || []).filter((item) => {
    if (filterThresholdOnly) {
      return item.currentStock <= item.reorderPoint;
    }
    return true;
  });

  return React.createElement(
    'div',
    {
      'data-testid': 'inventory-manager-view',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1000px',
        margin: '2rem auto',
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
      }
    },
    // Header
    React.createElement(
      'header',
      { style: { borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1.5rem' } },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement(
          'div',
          null,
          React.createElement('h1', { style: { margin: 0, fontSize: '1.5rem', color: '#111827' } }, 'Stock Thresholds & Supplier Replenishment'),
          React.createElement('p', { style: { margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' } }, 'Monitor warehouse stock levels, adjust safety thresholds, and dispatch supplier purchase orders.')
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'btn-refresh',
            onClick: loadInventory,
            disabled: isLoading,
            style: {
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }
          },
          isLoading ? 'Refreshing...' : 'Refresh Inventory'
        )
      )
    ),

    // Notification toast
    notification && React.createElement(
      'div',
      {
        'data-testid': 'notification-banner',
        style: {
          padding: '0.75rem 1rem',
          backgroundColor: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          borderRadius: '6px',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      },
      React.createElement('span', null, notification),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'btn-dismiss-notification',
          onClick: () => setNotification(null),
          style: { background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 'bold' }
        },
        '✕'
      )
    ),

    // Controls & Filter Bar
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          gap: '1rem'
        }
      },
      React.createElement(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          'data-testid': 'filter-reorder-checkbox',
          checked: filterThresholdOnly,
          onChange: (e) => setFilterThresholdOnly(e.target.checked)
        }),
        'Show only items below/at reorder threshold'
      ),
      React.createElement(
        'span',
        { 'data-testid': 'item-count-indicator', style: { fontSize: '0.875rem', color: '#6b7280' } },
        `Showing ${displayedItems.length} items`
      )
    ),

    // STATE 1: LOADING STATE
    isLoading && React.createElement(
      'div',
      {
        'data-testid': 'loading-state',
        style: {
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #d1d5db',
          color: '#4b5563'
        }
      },
      React.createElement('div', { style: { fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' } }, 'Loading Stock Catalog...'),
      React.createElement('div', { style: { fontSize: '0.875rem', color: '#9ca3af' } }, 'Synchronizing stock thresholds and supplier lead times...')
    ),

    // STATE 2: ERROR STATE
    !isLoading && errorMessage && React.createElement(
      'div',
      {
        'data-testid': 'error-state',
        style: {
          padding: '2rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          textAlign: 'center'
        }
      },
      React.createElement('h3', { style: { margin: '0 0 0.5rem 0' } }, 'Unable to Load Inventory'),
      React.createElement('p', { 'data-testid': 'error-message-text', style: { margin: '0 0 1rem 0', fontSize: '0.875rem' } }, errorMessage),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'btn-retry',
          onClick: loadInventory,
          style: {
            padding: '0.45rem 1rem',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }
        },
        'Retry Supplier Sync'
      )
    ),

    // STATE 3: EMPTY STATE
    !isLoading && !errorMessage && displayedItems.length === 0 && React.createElement(
      'div',
      {
        'data-testid': 'empty-state',
        style: {
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          color: '#6b7280'
        }
      },
      React.createElement('div', { style: { fontSize: '1.1rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' } }, 'No Inventory Items Found'),
      React.createElement(
        'p',
        { style: { margin: '0 0 1rem 0', fontSize: '0.875rem' } },
        filterThresholdOnly
          ? 'All catalog items currently meet or exceed their replenishment thresholds.'
          : 'No items currently configured in this warehouse partition.'
      ),
      filterThresholdOnly && React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'btn-clear-filter',
          onClick: () => setFilterThresholdOnly(false),
          style: {
            padding: '0.4rem 0.8rem',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer'
          }
        },
        'Clear Threshold Filter'
      )
    ),

    // STATE 4: DATA TABLE STATE
    !isLoading && !errorMessage && displayedItems.length > 0 && React.createElement(
      'table',
      {
        'data-testid': 'inventory-table',
        style: {
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.875rem'
        }
      },
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          { style: { backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' } },
          React.createElement('th', { style: { padding: '0.75rem' } }, 'Item / SKU'),
          React.createElement('th', { style: { padding: '0.75rem' } }, 'Current Stock'),
          React.createElement('th', { style: { padding: '0.75rem' } }, 'Status'),
          React.createElement('th', { style: { padding: '0.75rem' } }, 'Thresholds'),
          React.createElement('th', { style: { padding: '0.75rem' } }, 'Supplier Details'),
          React.createElement('th', { style: { padding: '0.75rem', textAlign: 'right' } }, 'Replenishment Action')
        )
      ),
      React.createElement(
        'tbody',
        null,
        displayedItems.map((item) => {
          const isAtRisk = item.currentStock <= item.reorderPoint;
          return React.createElement(
            'tr',
            {
              key: item.id,
              'data-testid': `row-${item.id}`,
              style: {
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: isAtRisk ? '#fffbeb' : '#ffffff'
              }
            },
            React.createElement(
              'td',
              { style: { padding: '0.75rem' } },
              React.createElement('div', { style: { fontWeight: '600', color: '#111827' } }, item.name),
              React.createElement('div', { style: { fontSize: '0.75rem', color: '#6b7280' } }, `${item.sku} • ${item.category}`)
            ),
            React.createElement(
              'td',
              { style: { padding: '0.75rem' } },
              // Reusable Component 2: ThresholdControl for testing current stock changes
              React.createElement(ThresholdControl, {
                label: 'Stock',
                value: item.currentStock,
                min: 0,
                onChange: (newVal) => handleUpdateStock(item.id, newVal)
              })
            ),
            React.createElement(
              'td',
              { style: { padding: '0.75rem' } },
              // Reusable Component 1: StatusBadge
              React.createElement(StatusBadge, {
                currentStock: item.currentStock,
                lowThreshold: item.lowThreshold,
                reorderPoint: item.reorderPoint
              })
            ),
            React.createElement(
              'td',
              { style: { padding: '0.75rem' } },
              // Reusable Component 2: ThresholdControl for lowThreshold adjustment
              React.createElement(ThresholdControl, {
                label: 'Low Alert',
                value: item.lowThreshold,
                min: 1,
                onChange: (newVal) => handleUpdateThreshold(item.id, newVal)
              }),
              React.createElement('div', { style: { fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' } }, `Reorder Point: ${item.reorderPoint}`)
            ),
            React.createElement(
              'td',
              { style: { padding: '0.75rem' } },
              React.createElement('div', { style: { fontWeight: '500', color: '#374151' } }, item.supplier),
              React.createElement('div', { style: { fontSize: '0.75rem', color: '#6b7280' } }, `Lead time: ${item.supplierLeadDays}d • Unit: $${item.unitCost.toFixed(2)}`)
            ),
            React.createElement(
              'td',
              { style: { padding: '0.75rem', textAlign: 'right' } },
              item.pendingOrder ? React.createElement(
                'span',
                {
                  'data-testid': `pending-badge-${item.id}`,
                  style: {
                    display: 'inline-block',
                    padding: '0.25rem 0.5rem',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }
                },
                `PO Pending: ${item.pendingOrder.quantity} units`
              ) : React.createElement(
                'button',
                {
                  type: 'button',
                  'data-testid': `btn-replenish-${item.id}`,
                  onClick: () => setSelectedReplenishItem(item),
                  style: {
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    borderRadius: '5px',
                    border: '1px solid #2563eb',
                    background: isAtRisk ? '#2563eb' : '#eff6ff',
                    color: isAtRisk ? '#ffffff' : '#1d4ed8',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }
                },
                'Order Replenishment'
              )
            )
          );
        })
      )
    ),

    // Reusable Component 3: ReplenishmentOrderModal
    React.createElement(ReplenishmentOrderModal, {
      item: selectedReplenishItem,
      isOpen: Boolean(selectedReplenishItem),
      isSubmitting: isSubmittingOrder,
      onClose: () => setSelectedReplenishItem(null),
      onConfirm: handleConfirmReplenishment
    })
  );
}

module.exports = {
  InventoryManagerView,
  INITIAL_INVENTORY
};
