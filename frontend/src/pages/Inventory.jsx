import { useEffect, useState, useCallback } from "react";
import { getInventory, getInventorySummary, addMedicine, updateMedicine, deleteMedicine } from "../api";

// colors for each status badge
const statusColors = {
  Active: { bg: "#dcfce7", color: "#16a34a" },
  "Low Stock": { bg: "#fef9c3", color: "#ca8a04" },
  Expired: { bg: "#fee2e2", color: "#dc2626" },
  "Out of Stock": { bg: "#f3f4f6", color: "#6b7280" },
};

const emptyForm = { name: "", generic_name: "", batch_no: "", expiry_date: "", quantity: 0, mrp: 0, supplier: "", status: "Active" };

export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([getInventory(search, statusFilter), getInventorySummary()])
      .then(([inv, sum]) => { setMedicines(inv.data); setSummary(sum.data); })
      .catch(() => setError("Failed to load inventory."))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (med) => { setForm(med); setEditId(med.id); setShowModal(true); };

  const handleSave = () => {
    const action = editId ? updateMedicine(editId, form) : addMedicine(form);
    action.then(() => { setShowModal(false); fetchData(); })
      .catch(() => alert("Failed to save medicine."));
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this medicine?"))
      deleteMedicine(id).then(fetchData);
  };

  if (loading) return <div style={{ padding: "40px", color: "#888" }}>Loading...</div>;
  if (error) return <div style={{ padding: "40px", color: "red" }}>{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a2e" }}>Inventory</h1>
          <p style={{ color: "#888", marginTop: "4px" }}>Manage your medicine stock</p>
        </div>
        <button onClick={openAdd} style={{
          background: "#4f46e5", color: "#fff", border: "none",
          padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "600"
        }}>+ Add Medicine</button>
      </div>

      {summary && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            { label: "Total Medicines", value: summary.total_medicines, color: "#4f46e5" },
            { label: "Active", value: summary.active, color: "#16a34a" },
            { label: "Low Stock", value: summary.low_stock, color: "#ca8a04" },
            { label: "Expired", value: summary.expired, color: "#dc2626" },
          ].map(c => (
            <div key={c.label} style={{
              flex: 1, background: "#fff", borderRadius: "12px", padding: "20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: `4px solid ${c.color}`
            }}>
              <div style={{ fontSize: "26px", fontWeight: "700", color: c.color }}>{c.value}</div>
              <div style={{ color: "#888", fontSize: "14px" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search medicines..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", outline: "none" }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "#fff" }}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>Low Stock</option>
          <option>Expired</option>
          <option>Out of Stock</option>
        </select>
      </div>

      <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Medicine Name", "Generic Name", "Batch No", "Expiry", "Qty", "MRP", "Supplier", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {medicines.map((med, i) => (
              <tr key={med.id} style={{ borderTop: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "12px 16px", fontWeight: "600", color: "#1a1a2e" }}>{med.name}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>{med.generic_name}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>{med.batch_no}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>{med.expiry_date}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>{med.quantity}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>₹{med.mrp}</td>
                <td style={{ padding: "12px 16px", color: "#555" }}>{med.supplier}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    background: statusColors[med.status]?.bg || "#f3f4f6",
                    color: statusColors[med.status]?.color || "#555",
                    padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600"
                  }}>{med.status}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={() => openEdit(med)} style={{
                    background: "#ede9fe", color: "#7c3aed", border: "none",
                    padding: "5px 12px", borderRadius: "6px", cursor: "pointer", marginRight: "6px", fontWeight: "600"
                  }}>Edit</button>
                  <button onClick={() => handleDelete(med.id)} style={{
                    background: "#fee2e2", color: "#dc2626", border: "none",
                    padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600"
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {medicines.length === 0 && <p style={{ padding: "24px", color: "#888", textAlign: "center" }}>No medicines found.</p>}
      </div>

      {/* modal for adding or editing a medicine */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", width: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: "700", marginBottom: "20px" }}>{editId ? "Edit Medicine" : "Add Medicine"}</h2>
            {[
              ["name", "Medicine Name"], ["generic_name", "Generic Name"],
              ["batch_no", "Batch No"], ["expiry_date", "Expiry Date (YYYY-MM-DD)"],
              ["quantity", "Quantity"], ["mrp", "MRP (₹)"], ["supplier", "Supplier"]
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "13px", color: "#555", display: "block", marginBottom: "4px" }}>{label}</label>
                <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: "9px 20px", borderRadius: "8px", border: "1px solid #e5e7eb",
                background: "#fff", cursor: "pointer", fontWeight: "600"
              }}>Cancel</button>
              <button onClick={handleSave} style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: "600"
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}