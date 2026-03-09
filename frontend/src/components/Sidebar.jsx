import { Link, useLocation } from "react-router-dom";

const links = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/inventory", label: "Inventory", icon: "💊" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  return (
    <div style={{
      width: "220px", background: "#fff", borderRight: "1px solid #eee",
      padding: "24px 16px", display: "flex", flexDirection: "column", gap: "8px"
    }}>
      <div style={{ fontWeight: "700", fontSize: "18px", marginBottom: "24px", color: "#1a1a2e" }}>
        💊 PharmaCRM
      </div>
      {links.map(link => (
        <Link key={link.path} to={link.path} style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px", borderRadius: "8px", textDecoration: "none",
          background: pathname === link.path ? "#4f46e5" : "transparent",
          color: pathname === link.path ? "#fff" : "#555",
          fontWeight: pathname === link.path ? "600" : "400",
        }}>
          {link.icon} {link.label}
        </Link>
      ))}
    </div>
  );
}