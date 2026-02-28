// server.js — CoinEd Backend
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const connectDB  = require('./config/db');

// Routes
const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/students');
const shopRoutes    = require('./routes/shop');

const app = express();



// ── Connect MongoDB ──────────────────────────────
connectDB();

// ── Middleware ───────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/shop',     shopRoutes);

// ── Health check ─────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: '✅ CoinEd API running',
    version: '1.0.0',
    endpoints: {
      auth:     '/api/auth',
      students: '/api/students',
      shop:     '/api/shop',
    }
  });
});

// ── 404 Handler ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ── Error Handler ────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// ── Start ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});
