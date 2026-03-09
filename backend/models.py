from pydantic import BaseModel
from typing import Optional
from datetime import date


class Medicine(BaseModel):
    name: str
    generic_name: Optional[str] = ""
    batch_no: Optional[str] = ""
    expiry_date: Optional[str] = ""
    quantity: int = 0
    mrp: float = 0.0
    supplier: Optional[str] = ""
    status: Optional[str] = "Active"


class Sale(BaseModel):
    patient_id: str
    patient_name: str
    total_amount: float
    payment_method: str
    items: list


def get_status(quantity, expiry_date):
    """figure out the correct status based on quantity and expiry date"""
    if quantity == 0:
        return "Out of Stock"
    try:
        exp = date.fromisoformat(expiry_date)
        if exp < date.today():
            return "Expired"
    except (ValueError, TypeError):
        pass
    if quantity < 10:
        return "Low Stock"
    return "Active"
