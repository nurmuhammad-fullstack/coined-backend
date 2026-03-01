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
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.CLIENT_URL,
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // allow all in development
    }
  },
  credentials: true,
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
// Only start bot if not already running (check if module is already loaded)
if (process.env.TELEGRAM_BOT_TOKEN && !global.telegramBotStarted) {
  global.telegramBotStarted = true;
  require('./bot');
  console.log('🤖 Telegram Bot started!');
} else if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.log('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled');
} else {
  console.log('⚠️  Bot already running, skipping...');
}

// ── Start server ─────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});
