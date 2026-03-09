import { useEffect, useState, useCallback } from "react";
import { getDashboardSummary, getRecentSales, searchMedicines, createSale } from "../api";

// reusable card for the summary section
const Card = ({ icon, bg, iconColor, label, value, badge, badgeColor }) => (
  <div style={{
    background: "#fff", borderRadius: "16px", padding: "24px",
    flex: 1, minWidth: "200px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)"
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: bg, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "20px", color: iconColor, fontWeight: "700"
      }}>{icon}</div>
      {badge && (
        <span style={{
          background: badgeColor + "18", color: badgeColor,
          padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600"
        }}>{badge}</span>
      )}
    </div>
    <div style={{ fontSize: "28px", fontWeight: "700", margin: "12px 0 4px", color: "#1a1a2e" }}>
      {value}
    </div>
    <div style={{ color: "#888", fontSize: "14px" }}>{label}</div>
  </div>
);

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Sales");

  // sale form state
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [saleLoading, setSaleLoading] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([getDashboardSummary(), getRecentSales()])
      .then(([s, r]) => {
        setSummary(s.data);
        setSales(r.data);
      })
      .catch(() => setError("Failed to load data. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // search medicines as user types (with debounce)
  useEffect(() => {
    if (medSearch.length < 1) {
      setSearchResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      searchMedicines(medSearch).then(res => setSearchResults(res.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [medSearch]);

  const addToCart = (med) => {
    if (cart.find(c => c.medicine_id === med.id)) return;
    setCart([...cart, {
      medicine_id: med.id, name: med.name, generic_name: med.generic_name,
      batch_no: med.batch_no, expiry_date: med.expiry_date,
      quantity: 1, price: med.mrp, mrp: med.mrp,
      supplier: med.supplier, max_qty: med.quantity
    }]);
    setMedSearch("");
    setSearchResults([]);
  };

  const updateCartQty = (medId, qty) => {
    setCart(cart.map(c => c.medicine_id === medId ? { ...c, quantity: Math.min(qty, c.max_qty) } : c));
  };

  const removeFromCart = (medId) => setCart(cart.filter(c => c.medicine_id !== medId));

  // handle billing - sends sale to backend
  const handleBill = () => {
    if (!patientId.trim() || cart.length === 0) {
      alert("Enter patient ID and add at least one medicine.");
      return;
    }
    setSaleLoading(true);
    const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
    createSale({
      patient_id: patientId,
      patient_name: patientName || patientId,
      total_amount: total,
      payment_method: "Cash",
      items: cart.map(c => ({ medicine_id: c.medicine_id, quantity: c.quantity, price: c.price }))
    })
      .then(() => {
        alert("Sale completed!");
        setCart([]);
        setPatientId("");
        setPatientName("");
        fetchData();
      })
      .catch(err => alert(err.response?.data?.detail || "Sale failed"))
      .finally(() => setSaleLoading(false));
  };

  // export sales as CSV file
  const exportCSV = () => {
    if (sales.length === 0) return;
    const headers = "Invoice,Patient,Items,Amount,Payment,Date,Status\n";
    const rows = sales.map(s =>
      `${s.invoice_no},${s.patient_name},${s.item_count},${s.total_amount},${s.payment_method},${s.date},${s.status}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sales_export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: "40px", color: "#888" }}>Loading...</div>;
  if (error) return <div style={{ padding: "40px", color: "red" }}>{error}</div>;

  const tabs = ["Sales", "Purchase", "Inventory"];

  return (
    <div>
      {/* header with export and add medicine buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a2e", margin: 0 }}>Pharmacy CRM</h1>
          <p style={{ color: "#888", marginTop: "4px" }}>Manage inventory, sales, and purchase orders</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={exportCSV} style={{
            background: "#fff", color: "#333", border: "1px solid #e5e7eb",
            padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: "600",
            display: "flex", alignItems: "center", gap: "6px"
          }}>↓ Export</button>
          <button onClick={() => window.location.href = "/inventory"} style={{
            background: "#4f46e5", color: "#fff", border: "none",
            padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontWeight: "600",
            display: "flex", alignItems: "center", gap: "6px"
          }}>+ Add Medicine</button>
        </div>
      </div>

      {/* summary cards */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "28px", flexWrap: "wrap" }}>
        <Card icon="$" bg="#dcfce7" iconColor="#16a34a" label="Today's Sales"
          value={`₹${summary.todays_sales.toLocaleString()}`}
          badge={`${summary.items_sold_today} Orders`} badgeColor="#16a34a" />
        <Card icon="🛒" bg="#dbeafe" iconColor="#2563eb" label="Items Sold Today"
          value={summary.items_sold_today}
          badge={`${summary.items_sold_today} Items`} badgeColor="#2563eb" />
        <Card icon="⚠" bg="#fff7ed" iconColor="#ea580c" label="Low Stock Items"
          value={summary.low_stock_count}
          badge={summary.low_stock_count > 0 ? "Action Needed" : "All Good"} badgeColor="#ea580c" />
        <Card icon="📦" bg="#f3e8ff" iconColor="#9333ea" label="Purchase Orders"
          value={`₹${summary.purchase_orders.value.toLocaleString()}`}
          badge={`${summary.purchase_orders.count} Pending`} badgeColor="#9333ea" />
      </div>

      {/* tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 18px", borderRadius: "8px", border: "1px solid #e5e7eb",
              background: activeTab === tab ? "#f0f0ff" : "#fff",
              color: activeTab === tab ? "#4f46e5" : "#555",
              fontWeight: activeTab === tab ? "600" : "400",
              cursor: "pointer", fontSize: "14px"
            }}>
              {tab === "Sales" && "🛒 "}{tab === "Purchase" && "📋 "}{tab === "Inventory" && "📦 "}{tab}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={{
            background: "#4f46e5", color: "#fff", border: "none",
            padding: "9px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px"
          }}>+ New Sale</button>
          <button style={{
            background: "#fff", color: "#555", border: "1px solid #e5e7eb",
            padding: "9px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px"
          }}>+ New Purchase</button>
        </div>
      </div>

      {/* make a sale section */}
      {activeTab === "Sales" && (
        <div style={{
          background: "#eef6ff", borderRadius: "16px", padding: "24px", marginBottom: "28px",
          border: "1px solid #d0e3ff"
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1a1a2e", marginBottom: "4px" }}>Make a Sale</h3>
          <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>Select medicines from inventory</p>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
            <input value={patientId} onChange={e => setPatientId(e.target.value)}
              placeholder="Patient Id"
              style={{
                padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb",
                outline: "none", width: "150px", background: "#fff"
              }} />
            <input value={patientName} onChange={e => setPatientName(e.target.value)}
              placeholder="Patient Name"
              style={{
                padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb",
                outline: "none", width: "180px", background: "#fff"
              }} />
            <div style={{ position: "relative", flex: 1 }}>
              <input value={medSearch} onChange={e => setMedSearch(e.target.value)}
                placeholder="🔍 Search medicines..."
                style={{
                  padding: "10px 14px", borderRadius: "10px", border: "1px solid #e5e7eb",
                  outline: "none", width: "100%", boxSizing: "border-box", background: "#fff"
                }} />
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "44px", left: 0, right: 0,
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px",
                  zIndex: 10, maxHeight: "200px", overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>
                  {searchResults.map(med => (
                    <div key={med.id} onClick={() => addToCart(med)} style={{
                      padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0",
                      display: "flex", justifyContent: "space-between"
                    }}>
                      <span>{med.name} <span style={{ color: "#888", fontSize: "12px" }}>({med.generic_name})</span></span>
                      <span style={{ color: "#888", fontSize: "12px" }}>Qty: {med.quantity} | ₹{med.mrp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setMedSearch(""); setSearchResults([]); }} style={{
              background: "#16a34a", color: "#fff", border: "none",
              padding: "10px 20px", borderRadius: "10px", cursor: "pointer", fontWeight: "600"
            }}>Enter</button>
            <button onClick={handleBill} disabled={saleLoading} style={{
              background: "#dc2626", color: "#fff", border: "none",
              padding: "10px 28px", borderRadius: "10px", cursor: "pointer", fontWeight: "700",
              marginLeft: "auto", opacity: saleLoading ? 0.6 : 1
            }}>{saleLoading ? "Processing..." : "Bill"}</button>
          </div>

          {/* cart table */}
          <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f6ff" }}>
                  {["Medicine Name", "Generic Name", "Batch No", "Expiry Date", "Quantity", "MRP / Price", "Supplier", "Status", "Actions"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left", fontSize: "12px",
                      color: "#6b7280", fontWeight: "600", textTransform: "uppercase"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: "20px", textAlign: "center", color: "#aaa", fontSize: "14px" }}>
                    Search and add medicines to create a sale
                  </td></tr>
                ) : cart.map(item => (
                  <tr key={item.medicine_id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "10px 14px", fontWeight: "600", color: "#1a1a2e" }}>{item.name}</td>
                    <td style={{ padding: "10px 14px", color: "#555" }}>{item.generic_name}</td>
                    <td style={{ padding: "10px 14px", color: "#555" }}>{item.batch_no}</td>
                    <td style={{ padding: "10px 14px", color: "#555" }}>{item.expiry_date}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <input type="number" min={1} max={item.max_qty} value={item.quantity}
                        onChange={e => updateCartQty(item.medicine_id, parseInt(e.target.value) || 1)}
                        style={{ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #e5e7eb", textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "10px 14px", color: "#555" }}>₹{item.mrp}</td>
                    <td style={{ padding: "10px 14px", color: "#555" }}>{item.supplier}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#dcfce7", color: "#16a34a", padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>Added</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => removeFromCart(item.medicine_id)} style={{
                        background: "#fee2e2", color: "#dc2626", border: "none",
                        padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px"
                      }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* recent sales list */}
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#1a1a2e" }}>
          Recent Sales
        </h2>
        {sales.length === 0 && <p style={{ color: "#888" }}>No sales yet.</p>}
        {sales.map((sale, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: i < sales.length - 1 ? "1px solid #f0f0f0" : "none"
          }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              <div style={{
                width: "40px", height: "40px", background: "#dcfce7",
                borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center"
              }}>🛒</div>
              <div>
                <div style={{ fontWeight: "600", color: "#1a1a2e" }}>{sale.invoice_no}</div>
                <div style={{ fontSize: "13px", color: "#888" }}>
                  {sale.patient_name} • {sale.item_count} items • {sale.payment_method}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "600", color: "#1a1a2e" }}>₹{sale.total_amount}</div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>{sale.date}</div>
              <span style={{
                background: "#dcfce7", color: "#16a34a",
                padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600"
              }}>{sale.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}