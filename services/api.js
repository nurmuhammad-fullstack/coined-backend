// src/services/api.js

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('coined_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const request = async (method, path, body = null) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

// ── Auth ─────────────────────────────────────────
export const authAPI = {
  login:         (email, password) => request('POST', '/auth/login', { email, password }),
  register:      (data)            => request('POST', '/auth/register', data),
  me:            ()                => request('GET',  '/auth/me'),
  createStudent: (data)            => request('POST', '/auth/create-student', data),
};

// ── Students ─────────────────────────────────────
export const studentsAPI = {
  getAll:          ()              => request('GET',  '/students'),
  getOne:          (id)            => request('GET',  `/students/${id}`),
  deleteOne:       (id)            => request('DELETE', `/students/${id}`),
  getTransactions: (id)            => request('GET',  `/students/${id}/transactions`),
  addCoins:        (id, amount, label, category) =>
    request('POST', `/students/${id}/coins`, { amount, type: 'earn', label, category }),
  removeCoins:     (id, amount, label, category) =>
    request('POST', `/students/${id}/coins`, { amount, type: 'spend', label, category }),
};

// ── Shop ─────────────────────────────────────────
export const shopAPI = {
  getAll:    ()     => request('GET',    '/shop'),
  addItem:   (item) => request('POST',   '/shop', item),
  deleteItem:(id)   => request('DELETE', `/shop/${id}`),
  buyItem:   (id)   => request('POST',   `/shop/${id}/buy`),
};

// ── Quizzes ──────────────────────────────────────
export const quizzesAPI = {
  getAll:        ()              => request('GET',    '/quizzes'),
  getOne:        (id)            => request('GET',    `/quizzes/${id}`),
  create:        (data)          => request('POST',   '/quizzes', data),
  update:        (id, data)      => request('PUT',    `/quizzes/${id}`, data),
  delete:        (id)            => request('DELETE', `/quizzes/${id}`),
  getAttempts:   (id)            => request('GET',    `/quizzes/${id}/attempts`),
  submitAttempt: (id, answers)   => request('POST',   `/quizzes/${id}/attempt`, { answers }),
  myAttempts:    ()              => request('GET',    '/quizzes/my-attempts'),
};