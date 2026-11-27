# Assignment Project: Library Lending & Warehouse Inventory Manager

This repository contains implementations for:
1. **React State & Component Design**: Warehouse Inventory Manager (Stock Thresholds & Supplier Replenishment)
2. **Express Middleware & Validation**: Library Lending System (Book Availability, Holds, and Overdue Reminders)

---

# Part 1: Inventory Manager: Stock Thresholds & Supplier Replenishment (React)

A React application view and component architecture tailored for warehouse inventory management: tracking stock levels against reorder thresholds, modifying safety limits, and placing purchase order replenishment with designated suppliers.

## Component Architecture & Reusable Components

The solution structures the UI into a main parent view and **3 modular, reusable presentation and interactive components**:

| Component | Responsibility | Props Contract | Reusability Scope |
|---|---|---|---|
| **`StatusBadge`** | Calculates and displays stock health status indicators (`Critical Low`, `Reorder Needed`, `Healthy`) | `currentStock`, `lowThreshold`, `reorderPoint` | Any warehouse, catalog, or ordering dashboard requiring threshold-based health status |
| **`ThresholdControl`** | Stepper control with increment/decrement buttons and bound minimums | `label`, `value`, `min`, `onChange`, `disabled` | Quantity counters, safety threshold adjustments, or order batch selectors |
| **`ReplenishmentOrderModal`** | Supplier PO order dialogue with dynamic cost estimation and supplier lead time display | `item`, `isOpen`, `onClose`, `onConfirm`, `isSubmitting` | Supplier ordering, purchase requisition, or warehouse restocking flows |

## State Ownership & Data Flow

State is intentionally partitioned between **Lifted Business State** in the container and **Local UI State** inside components:

```mermaid
flowchart TD
    subgraph InventoryManagerView ["InventoryManagerView (Parent Container)"]
        itemsState["items: InventoryItem[]"]
        loadingState["isLoading: boolean"]
        errorState["errorMessage: string | null"]
        filterState["filterThresholdOnly: boolean"]
        selectedModalItem["selectedReplenishItem: Item | null"]
        submittingState["isSubmittingOrder: boolean"]
    end

    subgraph StatusBadgeComp ["StatusBadge (Stateless Child)"]
        statusCalc["Derived status: Critical / Reorder / Healthy"]
    end

    subgraph ThresholdControlComp ["ThresholdControl (Controlled Child)"]
        stepper["Stepper Buttons (+ / -)"]
    end

    subgraph ModalComp ["ReplenishmentOrderModal (Hybrid Child)"]
        orderQty["Local State: orderQty"]
        shippingSpeed["Local State: deliverySpeed"]
    end

    itemsState -->|stock & threshold props| StatusBadgeComp
    itemsState -->|current value & onChange handlers| ThresholdControlComp
    selectedModalItem -->|item details| ModalComp
    stepper -->|handleUpdateStock / handleUpdateThreshold| itemsState
    ModalComp -->|onConfirm(orderDetails)| itemsState
```

### State Distribution Rationale:
1. **Parent-Owned State (`InventoryManagerView`)**:
   - `items`: The single source of truth for all catalog items, stock counts, configured low thresholds, and pending supplier orders.
   - `isLoading` & `errorMessage`: Global view lifecycle indicators governing full-screen loading, retry banners, or data rendering.
   - `filterThresholdOnly`: Filter toggle determining whether healthy items are hidden to highlight at-risk stock.
   - `selectedReplenishItem`: Dictates which item is actively being restocked in the modal.

2. **Component-Local State (`ReplenishmentOrderModal`)**:
   - `orderQty` and `deliverySpeed`: Transient form inputs before confirmation. The parent container does not need to know what the user types while adjusting order quantities until the PO is explicitly submitted.

3. **Stateless Controlled Components (`StatusBadge`, `ThresholdControl`)**:
   - Pure presentation and controlled input. They hold no internal state and derive output strictly from props.

## UI State Demonstrations: Loading, Empty, and Error States

The container handles four explicit UI states:

1. **Loading State (`isLoading = true`)**:
   - Renders a clean loading skeleton/banner (`Loading Stock Catalog...`) while synchronizing with the supplier network.
   - Disables controls and hides stale tables to avoid race conditions.

2. **Error State (`errorMessage != null`)**:
   - Displays an error container with a descriptive error message (e.g. `Supplier Network Outage (503): Cannot retrieve stock counts`).
   - Surfaces a direct **"Retry Supplier Sync"** button that invokes `loadInventory()`.

3. **Empty State (`displayedItems.length === 0`)**:
   - Distinguishes between two conditions:
     - Truly empty warehouse catalog: Informs the operator that no inventory items exist.
     - Empty due to active filter: Informs the operator that all items are healthy and offers a **"Clear Threshold Filter"** action button.

4. **Populated Data State**:
   - Highlights items at risk (colored row backdrop for items below reorder point).
   - Shows active pending badges (`PO Pending: 36 units`) once a replenishment PO has been confirmed.

## Architectural Trade-offs & Decisions

### 1. In-Memory Component State vs. Global State Management (Zustand/Redux)
- **Decision**: Used React's built-in `useState` and `useCallback` lifted to `InventoryManagerView`.
- **Trade-off**: For a single view or small app, keeping state local to the page avoids boilerplate, extra dependencies, and architectural complexity. If this inventory view expands into multi-warehouse navigation or checkout pipelines, migrating `items` into a global store (e.g. Redux Toolkit or TanStack Query) would be necessary for caching and cross-view synchronization.

### 2. Controlled Stepper vs. Free-form Text Inputs
- **Decision**: Designed `ThresholdControl` with bounded step controls (`+` and `-`) preventing negative inventory or safety thresholds below 0.
- **Trade-off**: Steppers provide immediate validation and prevent malformed inputs, but are slower for massive batch quantity entries (e.g. changing 5 to 5,000 units), where free-text input fields are faster.

### 3. Server-Side Rendering (SSR) Test Suite vs. JSDOM Browser Testing
- **Decision**: Built the test suite using `react-dom/server` (`renderToStaticMarkup`) with Node's native `assert` runner.
- **Trade-off**: Runs instantly in Node without heavy browser mocks or Babel pipelines, validating all state branches, markup contracts, and props logic. However, synthetic DOM click events are tested at the unit handler boundary rather than through simulated browser pointer clicks.

## Automated Test Execution & Output

Run the test suite with:
```bash
npm test
```

### Verified Test Output
```text
> assignment-app@1.0.0 test
> node test/react-inventory.test.js

--- React Component & State Design Test Suite: Inventory Manager ---

✔ Passed: StatusBadge renders Critical Low, Reorder Needed, and Healthy based on thresholds
✔ Passed: ThresholdControl renders label, min threshold check, and decrement/increment buttons
✔ Passed: ReplenishmentOrderModal renders null when closed and renders details when open
✔ Passed: InventoryManagerView renders designated Loading State
✔ Passed: InventoryManagerView renders designated Error State with message and retry trigger
✔ Passed: InventoryManagerView renders designated Empty State when items array is empty
✔ Passed: InventoryManagerView renders populated inventory items with supplier details

Results: 7 test scenarios executed and passed successfully!
```

---

# Part 2: Library Lending System: Express Middleware, Validation & Error Handling

An Express API built specifically for a library lending system supporting **book availability checks**, **placing holds**, and **overdue reminder dispatches**.

- **Endpoints**:
  - `GET /books/:bookId/availability`
  - `POST /holds`
  - `POST /reminders/overdue`
  - `GET /health`
- **Tests & Demo**:
  - `npm run test:library`
  - `npm run demo:library`
