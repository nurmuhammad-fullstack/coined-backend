// src/context/AppContext.jsx (UPDATED - real API version)
// Bu faylni coined_final/src/context/AppContext.jsx ga replace qiling

import { createContext, useContext, useState, useEffect } from "react";
import { authAPI, studentsAPI, shopAPI } from "../services/api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [students,    setStudents]         = useState([]);
  const [shopItems,   setShopItems]        = useState([]);
  const [transactions,setTransactions]     = useState({});  // { userId: [tx, ...] }
  const [toast,       setToast]            = useState(null);
  const [loading,     setLoading]          = useState(true);

  // ── Restore session on load ──────────────────────
  useEffect(() => {
    const token = localStorage.getItem('coined_token');
    if (token) {
      authAPI.me()
        .then(user => setCurrentUser(user))
        .catch(() => localStorage.removeItem('coined_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ── Toast ────────────────────────────────────────
  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Auth ─────────────────────────────────────────
  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    localStorage.setItem('coined_token', data.token);
    setCurrentUser(data.user);
    return { ok: true, role: data.user.role };
  };

  const logout = () => {
    localStorage.removeItem('coined_token');
    setCurrentUser(null);
    setStudents([]);
    setShopItems([]);
    setTransactions({});
  };

  // ── Students ─────────────────────────────────────
  const loadStudents = async () => {
    const data = await studentsAPI.getAll();
    setStudents(data);
  };

  const getStudentCoins = (id) => {
    const s = students.find(s => s._id === id);
    return s?.coins ?? 0;
  };

  const getStudentTransactions = (id) => transactions[id] || [];

  const loadTransactions = async (studentId) => {
    if (transactions[studentId]) return; // already loaded
    const data = await studentsAPI.getTransactions(studentId);
    setTransactions(prev => ({ ...prev, [studentId]: data }));
  };

  const addCoins = async (studentId, amount, label, category) => {
    const data = await studentsAPI.addCoins(studentId, amount, label, category);
    // Update student coins in list
    setStudents(prev => prev.map(s => s._id === studentId ? { ...s, coins: data.student.coins } : s));
    // Update current user if student is viewing their own
    if (currentUser?._id === studentId) setCurrentUser(prev => ({ ...prev, coins: data.student.coins }));
    // Add tx to cache
    setTransactions(prev => ({
      ...prev,
      [studentId]: [data.transaction, ...(prev[studentId] || [])]
    }));
  };

  const removeCoins = async (studentId, amount, label, category) => {
    const data = await studentsAPI.removeCoins(studentId, amount, label, category);
    setStudents(prev => prev.map(s => s._id === studentId ? { ...s, coins: data.student.coins } : s));
    if (currentUser?._id === studentId) setCurrentUser(prev => ({ ...prev, coins: data.student.coins }));
    setTransactions(prev => ({
      ...prev,
      [studentId]: [data.transaction, ...(prev[studentId] || [])]
    }));
  };

  // ── Shop ─────────────────────────────────────────
  const loadShop = async () => {
    const data = await shopAPI.getAll();
    setShopItems(data);
  };

  const addShopItem = async (item) => {
    const newItem = await shopAPI.addItem(item);
    setShopItems(prev => [newItem, ...prev]);
  };

  const removeShopItem = async (id) => {
    await shopAPI.deleteItem(id);
    setShopItems(prev => prev.filter(i => i._id !== id));
  };

  const spendCoins = async (userId, item) => {
    const data = await shopAPI.buyItem(item._id);
    setCurrentUser(prev => ({ ...prev, coins: data.student.coins }));
    setTransactions(prev => ({
      ...prev,
      [userId]: [data.transaction, ...(prev[userId] || [])]
    }));
    return true;
  };

  return (
    <AppContext.Provider value={{
      currentUser, login, logout, loading,
      students, loadStudents, getStudentCoins,
      transactions, loadTransactions, getStudentTransactions,
      addCoins, removeCoins, spendCoins,
      shopItems, loadShop, addShopItem, removeShopItem,
      toast, showToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
