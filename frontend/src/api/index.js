import axios from "axios";

// backend URL – uses env var in production, localhost in dev
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const getDashboardSummary = () => axios.get(`${BASE}/dashboard/summary`);
export const getRecentSales = () => axios.get(`${BASE}/dashboard/recent-sales`);
export const getInventory = (search = "", status = "") =>
  axios.get(`${BASE}/inventory`, { params: { search, status } });
export const getInventorySummary = () => axios.get(`${BASE}/inventory/summary`);
export const addMedicine = (data) => axios.post(`${BASE}/inventory`, data);
export const updateMedicine = (id, data) => axios.put(`${BASE}/inventory/${id}`, data);
export const deleteMedicine = (id) => axios.delete(`${BASE}/inventory/${id}`);
export const createSale = (data) => axios.post(`${BASE}/sales`, data);
export const searchMedicines = (q) => axios.get(`${BASE}/medicines/search`, { params: { q } });