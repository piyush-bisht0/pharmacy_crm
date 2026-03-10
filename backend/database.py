import sqlite3
import os
from contextlib import contextmanager

# Use env var for DB path (Vercel uses /tmp), fallback to local file
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "pharmacy.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db_connection():
    """Context manager that auto-closes the connection."""
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            generic_name TEXT,
            batch_no TEXT,
            expiry_date TEXT,
            quantity INTEGER DEFAULT 0,
            mrp REAL,
            supplier TEXT,
            status TEXT DEFAULT 'Active'
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT,
            patient_id TEXT,
            patient_name TEXT,
            total_amount REAL,
            payment_method TEXT,
            date TEXT DEFAULT (date('now')),
            status TEXT DEFAULT 'Completed'
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            medicine_id INTEGER,
            quantity INTEGER,
            price REAL,
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );
    """)

    # sample data
    cursor.execute("SELECT COUNT(*) FROM medicines")
    if cursor.fetchone()[0] == 0:
        cursor.executescript("""
            INSERT INTO medicines (name, generic_name, batch_no, expiry_date, quantity, mrp, supplier, status)
            VALUES
            ('Paracetamol 500mg', 'Paracetamol', 'B001', '2027-06-01', 5, 10.0, 'Sun Pharma', 'Low Stock'),
            ('Amoxicillin 250mg', 'Amoxicillin', 'B002', '2027-09-01', 100, 45.0, 'Cipla', 'Active'),
            ('Metformin 500mg', 'Metformin', 'B003', '2024-01-01', 0, 30.0, 'Dr Reddys', 'Expired'),
            ('Atorvastatin 10mg', 'Atorvastatin', 'B004', '2027-12-01', 3, 55.0, 'Zydus', 'Low Stock'),
            ('Azithromycin 500mg', 'Azithromycin', 'B005', '2027-03-01', 80, 120.0, 'Sun Pharma', 'Active');

            INSERT INTO sales (invoice_no, patient_id, patient_name, total_amount, payment_method, date, status)
            VALUES
            ('INV-2024-1234', 'P001', 'Rajesh Kumar', 340.0, 'Card', date('now'), 'Completed'),
            ('INV-2024-1235', 'P002', 'Sarah Smith', 145.0, 'Cash', date('now'), 'Completed'),
            ('INV-2024-1236', 'P003', 'Michael Johnson', 625.0, 'UPI', date('now'), 'Completed');

            INSERT INTO sale_items (sale_id, medicine_id, quantity, price)
            VALUES
            (1, 1, 2, 10.0),
            (1, 2, 4, 45.0),
            (2, 4, 1, 55.0),
            (2, 5, 1, 120.0),
            (3, 2, 5, 45.0),
            (3, 5, 3, 120.0);
        """) 

    conn.commit()
    conn.close()