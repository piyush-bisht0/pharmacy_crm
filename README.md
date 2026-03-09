# PharmaCRM — Pharmacy Management Module

A simplified Pharmacy CRM with **Dashboard** and **Inventory** pages, powered by a **FastAPI** (Python) backend and a **React** (Vite) frontend.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [REST API Contracts](#rest-api-contracts)
5. [Data Consistency Strategy](#data-consistency-strategy)
6. [Deployment](#deployment)

---

## Tech Stack

| Layer    | Technology                |
| -------- | ------------------------- |
| Backend  | Python 3.10+, FastAPI     |
| Database | SQLite                    |
| Frontend | React 19, Vite, Axios     |
| Routing  | React Router v7           |

---

## Project Structure

```
pharmacy-crm/
├── backend/
│   ├── __init__.py
│   ├── main.py           # All API endpoints
│   ├── models.py          # Pydantic models & status logic
│   ├── database.py        # DB connection & schema init
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/index.js   # Axios API client
│   │   ├── components/
│   │   │   └── Sidebar.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       └── Inventory.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
Interactive docs at `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## REST API Contracts

### Dashboard

#### `GET /dashboard/summary`

Returns today's sales overview.

**Response `200 OK`**
```json
{
  "todays_sales": 1110.0,
  "items_sold_today": 16,
  "low_stock_count": 2,
  "purchase_orders": {
    "count": 3,
    "value": 650.0
  }
}
```

#### `GET /dashboard/recent-sales`

Returns the 10 most recent sales.

**Response `200 OK`**
```json
[
  {
    "invoice_no": "INV-2026-1234",
    "patient_name": "Rajesh Kumar",
    "total_amount": 340.0,
    "payment_method": "Card",
    "date": "2026-03-10",
    "status": "Completed",
    "item_count": 2
  }
]
```

---

### Inventory

#### `GET /inventory`

List all medicines. Supports optional query params for search and status filter.

| Param    | Type   | Description                                          |
| -------- | ------ | ---------------------------------------------------- |
| `search` | string | Filter by name, generic name, or supplier (LIKE)     |
| `status` | string | Filter by status: Active, Low Stock, Expired, Out of Stock |

**Response `200 OK`**
```json
[
  {
    "id": 1,
    "name": "Paracetamol 500mg",
    "generic_name": "Paracetamol",
    "batch_no": "B001",
    "expiry_date": "2027-06-01",
    "quantity": 5,
    "mrp": 10.0,
    "supplier": "Sun Pharma",
    "status": "Low Stock"
  }
]
```

#### `GET /inventory/summary`

Returns inventory statistics.

**Response `200 OK`**
```json
{
  "total_medicines": 5,
  "active": 2,
  "low_stock": 2,
  "expired": 1
}
```

#### `POST /inventory`

Add a new medicine. Status is auto-calculated by the server based on quantity and expiry date.

**Request Body**
```json
{
  "name": "Paracetamol 500mg",
  "generic_name": "Paracetamol",
  "batch_no": "B001",
  "expiry_date": "2027-06-01",
  "quantity": 50,
  "mrp": 10.0,
  "supplier": "Sun Pharma"
}
```

**Response `201 Created`**
```json
{
  "message": "Medicine added",
  "id": 6
}
```

#### `PUT /inventory/{medicine_id}`

Update an existing medicine. Status is recomputed from the new quantity/expiry values.

**Request Body** — same schema as POST.

**Response `200 OK`**
```json
{
  "message": "Medicine updated"
}
```

**Error `404 Not Found`**
```json
{
  "detail": "Medicine not found"
}
```

#### `DELETE /inventory/{medicine_id}`

Delete a medicine by ID.

**Response `200 OK`**
```json
{
  "message": "Medicine deleted"
}
```

---

### Sales

#### `POST /sales`

Create a new sale and deduct stock. Validates stock availability before committing.

**Request Body**
```json
{
  "patient_id": "P001",
  "patient_name": "Rajesh Kumar",
  "total_amount": 340.0,
  "payment_method": "Cash",
  "items": [
    { "medicine_id": 1, "quantity": 2, "price": 10.0 },
    { "medicine_id": 2, "quantity": 4, "price": 45.0 }
  ]
}
```

**Response `201 Created`**
```json
{
  "message": "Sale created",
  "invoice_no": "INV-2026-1237",
  "sale_id": 4
}
```

**Error `400 Bad Request`**
```json
{
  "detail": "Not enough stock for Paracetamol 500mg"
}
```

**Error `404 Not Found`**
```json
{
  "detail": "Medicine ID 99 not found"
}
```

#### `GET /medicines/search?q=para`

Search medicines by name/generic name for the billing UI. Excludes expired and out-of-stock items.

**Response `200 OK`** — array of medicine objects (same schema as inventory list).

---

## Data Consistency Strategy

The backend ensures data consistency on every update through the following mechanisms:

### 1. Auto-calculated Status

The `get_status(quantity, expiry_date)` function in `models.py` dynamically determines a medicine's status:

| Condition                | Status         |
| ------------------------ | -------------- |
| `quantity == 0`          | Out of Stock   |
| `expiry_date < today`   | Expired        |
| `quantity < 10`          | Low Stock      |
| Otherwise               | Active         |

This function is called:
- When **adding** a medicine (`POST /inventory`) — status is computed server-side, never trusted from the client.
- When **updating** a medicine (`PUT /inventory/{id}`) — status is recomputed from the new quantity/expiry values.
- When **creating a sale** (`POST /sales`) — after deducting stock for each item, the status is recalculated and persisted.
- When **reading** inventory (`GET /inventory`, `GET /inventory/summary`, `GET /dashboard/summary`) — status is recalculated against today's date to catch newly expired items without requiring a manual update.

### 2. Transactional Sales

The `POST /sales` endpoint runs inside a transaction:
1. **Stock validation** — checks ALL items have sufficient quantity before making any changes.
2. **Atomic commit** — sale record, sale items, and stock deductions are committed together in a single `db.commit()`.
3. **Rollback on failure** — if any step fails (insufficient stock, missing medicine, DB error), `db.rollback()` is called so no partial data is saved.

### 3. Connection Safety

All database connections use a context manager (`get_db_connection()`) that guarantees the connection is closed even if an exception occurs, preventing connection leaks.

---

## Pages

### Dashboard
- Summary cards (today's sales, items sold, low stock, purchase orders)
- Tabs for Sales / Purchase / Inventory views
- Make a Sale form with live medicine search, cart management, and billing
- Export recent sales to CSV
- Recent sales list with invoice, patient, amount, payment method, and status

### Inventory
- Summary cards (total medicines, active, low stock, expired)
- Full inventory table with search and status filter
- Add / Edit / Delete medicines via modal
- Status badges color-coded: Active (green), Low Stock (yellow), Expired (red), Out of Stock (gray)

---

## License

This project was built as part of the SwasthiQ SDE Intern assignment.
