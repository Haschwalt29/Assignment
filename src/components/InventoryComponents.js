const React = require('react');

/**
 * StatusBadge Component
 * Reusable badge displaying stock level health (Low Stock / Reorder Point / Healthy)
 */
function StatusBadge({ currentStock, lowThreshold, reorderPoint }) {
  let label = 'Healthy';
  let badgeStyle = {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #a7f3d0'
  };

  if (currentStock <= lowThreshold) {
    label = 'Critical Low';
    badgeStyle = {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
      border: '1px solid #fecaca'
    };
  } else if (currentStock <= reorderPoint) {
    label = 'Reorder Needed';
    badgeStyle = {
      backgroundColor: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a'
    };
  }

  return React.createElement(
    'span',
    {
      'data-testid': 'status-badge',
      style: {
        display: 'inline-block',
        padding: '0.2rem 0.55rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
        ...badgeStyle
      }
    },
    label
  );
}

/**
 * ThresholdControl Component
 * Reusable control allowing adjustments to low-stock threshold or manual stock counters
 */
function ThresholdControl({ label, value, min = 0, onChange, disabled = false }) {
  return React.createElement(
    'div',
    {
      'data-testid': 'threshold-control',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.85rem'
      }
    },
    React.createElement('span', { style: { color: '#4b5563', fontWeight: '500' } }, `${label}:`),
    React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `btn-decrement-${label.toLowerCase().replace(/\s+/g, '-')}`,
        disabled: disabled || value <= min,
        onClick: () => onChange(Math.max(min, value - 1)),
        style: {
          padding: '0.15rem 0.45rem',
          fontSize: '0.8rem',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          background: disabled || value <= min ? '#f3f4f6' : '#fff',
          cursor: disabled || value <= min ? 'not-allowed' : 'pointer'
        }
      },
      '-'
    ),
    React.createElement(
      'strong',
      { 'data-testid': `val-${label.toLowerCase().replace(/\s+/g, '-')}`, style: { minWidth: '1.5rem', textAlign: 'center' } },
      value
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `btn-increment-${label.toLowerCase().replace(/\s+/g, '-')}`,
        disabled,
        onClick: () => onChange(value + 1),
        style: {
          padding: '0.15rem 0.45rem',
          fontSize: '0.8rem',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          background: disabled ? '#f3f4f6' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }
      },
      '+'
    )
  );
}

/**
 * ReplenishmentOrderModal Component
 * Reusable modal for confirming purchase order replenishment with preferred supplier
 */
function ReplenishmentOrderModal({ item, isOpen, onClose, onConfirm, isSubmitting }) {
  if (!isOpen || !item) return null;

  const defaultReorderQty = Math.max(10, (item.reorderPoint * 2) - item.currentStock);
  const [orderQty, setOrderQty] = React.useState(defaultReorderQty);
  const [deliverySpeed, setDeliverySpeed] = React.useState('standard');

  const unitCost = item.unitCost || 12.5;
  const estimatedTotal = (orderQty * unitCost).toFixed(2);

  return React.createElement(
    'div',
    {
      'data-testid': 'replenishment-modal-overlay',
      style: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }
    },
    React.createElement(
      'div',
      {
        'data-testid': 'replenishment-modal',
        style: {
          background: '#fff',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '420px',
          maxWidth: '90%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
        }
      },
      React.createElement('h3', { style: { marginTop: 0, marginBottom: '0.5rem', color: '#111827' } }, 'Create Supplier Replenishment Order'),
      React.createElement(
        'p',
        { style: { fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' } },
        `Replenish item: `,
        React.createElement('strong', null, item.name),
        ` (${item.sku}) from supplier `,
        React.createElement('strong', null, item.supplier)
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' } },
        React.createElement(
          'label',
          { style: { fontSize: '0.85rem', color: '#374151', fontWeight: '500' } },
          'Order Quantity (units):',
          React.createElement('input', {
            type: 'number',
            'data-testid': 'order-qty-input',
            min: 1,
            value: orderQty,
            onChange: (e) => setOrderQty(Math.max(1, parseInt(e.target.value, 10) || 1)),
            style: {
              width: '100%',
              padding: '0.45rem',
              marginTop: '0.25rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px'
            }
          })
        ),
        React.createElement(
          'label',
          { style: { fontSize: '0.85rem', color: '#374151', fontWeight: '500' } },
          'Shipping Speed:',
          React.createElement(
            'select',
            {
              'data-testid': 'order-speed-select',
              value: deliverySpeed,
              onChange: (e) => setDeliverySpeed(e.target.value),
              style: {
                width: '100%',
                padding: '0.45rem',
                marginTop: '0.25rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }
            },
            React.createElement('option', { value: 'standard' }, 'Standard Freight (5-7 business days)'),
            React.createElement('option', { value: 'expedited' }, 'Expedited Rush (1-2 business days)')
          )
        ),
        React.createElement(
          'div',
          {
            style: {
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              fontSize: '0.85rem',
              color: '#374151'
            }
          },
          React.createElement('div', null, `Supplier Lead Time: `, React.createElement('strong', null, `${item.supplierLeadDays} days`)),
          React.createElement('div', null, `Estimated Total Cost: `, React.createElement('strong', null, `$${estimatedTotal}`))
        )
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' } },
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'btn-cancel-modal',
            disabled: isSubmitting,
            onClick: onClose,
            style: {
              padding: '0.45rem 0.9rem',
              borderRadius: '5px',
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer'
            }
          },
          'Cancel'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'btn-confirm-order',
            disabled: isSubmitting,
            onClick: () => onConfirm({
              itemId: item.id,
              quantity: orderQty,
              supplier: item.supplier,
              shippingSpeed: deliverySpeed,
              totalCost: parseFloat(estimatedTotal)
            }),
            style: {
              padding: '0.45rem 0.9rem',
              borderRadius: '5px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }
          },
          isSubmitting ? 'Submitting PO...' : 'Confirm Replenishment PO'
        )
      )
    )
  );
}

module.exports = {
  StatusBadge,
  ThresholdControl,
  ReplenishmentOrderModal
};
