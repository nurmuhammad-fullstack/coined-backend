// server.js
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const connectDB  = require('./config/db');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/students');
const shopRoutes    = require('./routes/shop');
const quizRoutes    = require('./routes/quizzes');

const app = express();

// ── Connect MongoDB ──────────────────────────────
connectDB();

// ── CORS ─────────────────────────────────────────
app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/shop',     shopRoutes);
app.use('/api/quizzes',  quizRoutes);

// ── Health check ─────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Start Telegram Bot ───────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN) {
  require('./bot');
  console.log('🤖 Telegram Bot started!');
} else {
  console.log('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled');
}

// ── Start server ─────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});