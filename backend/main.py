import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

try:
    from .database import get_db, get_db_connection, init_db
    from .models import Medicine, Sale, get_status
except ImportError:
    from database import get_db, get_db_connection, init_db
    from models import Medicine, Sale, get_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="PharmaCRM API", lifespan=lifespan)

# allow frontend to connect
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- dashboard ---

@app.get("/dashboard/summary")
def get_dashboard_summary():
    with get_db_connection() as db:
        cursor = db.cursor()

        cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE date = date('now')")
        todays_sales = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COALESCE(SUM(si.quantity), 0)
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.date = date('now')
        """)
        items_sold = cursor.fetchone()[0]

        # recalculate low stock and purchase orders dynamically
        cursor.execute("SELECT quantity, expiry_date FROM medicines")
        all_meds = cursor.fetchall()
        low_stock = 0
        purchase_orders_count = 0
        for m in all_meds:
            s = get_status(m["quantity"], m["expiry_date"])
            if s == "Low Stock":
                low_stock += 1
            if s in ("Low Stock", "Out of Stock"):
                purchase_orders_count += 1

        cursor.execute("SELECT COALESCE(SUM(mrp * 10), 0) FROM medicines WHERE quantity < 10 AND quantity > 0")
        purchase_orders_value = cursor.fetchone()[0]

        return {
            "todays_sales": todays_sales,
            "items_sold_today": items_sold,
            "low_stock_count": low_stock,
            "purchase_orders": {
                "count": purchase_orders_count,
                "value": purchase_orders_value
            }
        }

@app.get("/dashboard/recent-sales")
def get_recent_sales():
    with get_db_connection() as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT s.invoice_no, s.patient_name, s.total_amount,s.payment_method, s.date, s.status,
            COUNT(si.id) as item_count
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            GROUP BY s.id
            ORDER BY s.id DESC
            LIMIT 10
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


# --- inventory ---

@app.get("/inventory")
def get_inventory(search: Optional[str] = None, status: Optional[str] = None):
    with get_db_connection() as db:
        cursor = db.cursor()

        query = "SELECT * FROM medicines WHERE 1=1"
        params = []

        if search:
            query += " AND (name LIKE ? OR generic_name LIKE ? OR supplier LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        if status:
            query += " AND status = ?"
            params.append(status)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # recalculate status based on current date
        results = []
        for row in rows:
            med = dict(row)
            med["status"] = get_status(med["quantity"], med["expiry_date"])
            results.append(med)
        return results

@app.get("/inventory/summary")
def get_inventory_summary():
    with get_db_connection() as db:
        cursor = db.cursor()
        cursor.execute("SELECT * FROM medicines")
        rows = cursor.fetchall()

        # count by recalculated status
        total = len(rows)
        active = 0
        low_stock = 0
        expired = 0
        for row in rows:
            s = get_status(row["quantity"], row["expiry_date"])
            if s == "Active":
                active += 1
            elif s == "Low Stock":
                low_stock += 1
            elif s == "Expired":
                expired += 1

        return {
            "total_medicines": total,
            "active": active,
            "low_stock": low_stock,
            "expired": expired
        }

@app.post("/inventory", status_code=201)
def add_medicine(medicine: Medicine):
    with get_db_connection() as db:
        cursor = db.cursor()
        # auto-calculate status from quantity and expiry
        status = get_status(medicine.quantity, medicine.expiry_date)
        cursor.execute("""
            INSERT INTO medicines (name, generic_name, batch_no, expiry_date, quantity, mrp, supplier, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (medicine.name, medicine.generic_name, medicine.batch_no,
            medicine.expiry_date, medicine.quantity, medicine.mrp,
            medicine.supplier, status))
        db.commit()
        new_id = cursor.lastrowid
        return {"message": "Medicine added", "id": new_id}

@app.put("/inventory/{medicine_id}")
def update_medicine(medicine_id: int, medicine: Medicine):
    with get_db_connection() as db:
        cursor = db.cursor()
        cursor.execute("SELECT id FROM medicines WHERE id = ?", (medicine_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Medicine not found")

        # auto-calculate status from quantity and expiry
        status = get_status(medicine.quantity, medicine.expiry_date)
        cursor.execute("""
            UPDATE medicines SET name=?, generic_name=?, batch_no=?, expiry_date=?,
            quantity=?, mrp=?, supplier=?, status=? WHERE id=?
        """,
            (medicine.name, medicine.generic_name, medicine.batch_no,
            medicine.expiry_date, medicine.quantity, medicine.mrp,
            medicine.supplier, status, medicine_id))
        db.commit()
        return {"message": "Medicine updated"}

@app.delete("/inventory/{medicine_id}")
def delete_medicine(medicine_id: int):
    with get_db_connection() as db:
        cursor = db.cursor()
        cursor.execute("DELETE FROM medicines WHERE id = ?", (medicine_id,))
        db.commit()
        return {"message": "Medicine deleted"}


# --- sales ---

@app.post("/sales", status_code=201)
def create_sale(sale: Sale):
    with get_db_connection() as db:
        cursor = db.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM sales")
            count = cursor.fetchone()[0]
            from datetime import date as dt_date
            year = dt_date.today().year
            invoice_no = f"INV-{year}-{1234 + count}"

            # check if stock is available
            for item in sale.items:
                cursor.execute("SELECT quantity, name FROM medicines WHERE id = ?", (item["medicine_id"],))
                med = cursor.fetchone()
                if not med:
                    raise HTTPException(status_code=404, detail=f"Medicine ID {item['medicine_id']} not found")
                if med["quantity"] < item["quantity"]:
                    raise HTTPException(status_code=400, detail=f"Not enough stock for {med['name']}")

            cursor.execute("""
                INSERT INTO sales (invoice_no, patient_id, patient_name, total_amount, payment_method)
                VALUES (?, ?, ?, ?, ?)
            """, (invoice_no, sale.patient_id, sale.patient_name, sale.total_amount, sale.payment_method))
            sale_id = cursor.lastrowid

            # save each item and reduce stock
            for item in sale.items:
                cursor.execute("""
                    INSERT INTO sale_items (sale_id, medicine_id, quantity, price)
                    VALUES (?, ?, ?, ?)
                """, (sale_id, item["medicine_id"], item["quantity"], item["price"]))

                cursor.execute("UPDATE medicines SET quantity = quantity - ? WHERE id = ?",(item["quantity"], item["medicine_id"]))

                # recalculate status after stock change
                cursor.execute("SELECT quantity, expiry_date FROM medicines WHERE id = ?", (item["medicine_id"],))
                row = cursor.fetchone()
                new_status = get_status(row["quantity"], row["expiry_date"])
                cursor.execute("UPDATE medicines SET status = ? WHERE id = ?", (new_status, item["medicine_id"]))

            db.commit()
            return {"message": "Sale created", "invoice_no": invoice_no, "sale_id": sale_id}
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/medicines/search")
def search_medicines(q: str = ""):
    with get_db_connection() as db:
        cursor = db.cursor()
        cursor.execute("""
            SELECT * FROM medicines
            WHERE (name LIKE ? OR generic_name LIKE ?)
            AND quantity > 0
            LIMIT 10
        """, (f"%{q}%", f"%{q}%"))
        rows = cursor.fetchall()
        # only return medicines that aren't expired
        results = []
        for row in rows:
            med = dict(row)
            med["status"] = get_status(med["quantity"], med["expiry_date"])
            if med["status"] != "Expired":
                results.append(med)
        return results

