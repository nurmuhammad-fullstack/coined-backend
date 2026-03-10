// server.js
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/students');
const shopRoutes    = require('./routes/shop');
const quizRoutes    = require('./routes/quizzes');

const app = express();

connectDB();

// ✅ CORS — Vercel va barcha originlarga ruxsat
app.use(cors({
  origin: function(origin, callback) {
    // Ruxsat berilgan domenlar
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://coined-frontent.vercel.app',
      'https://coined-frontend.vercel.app',
      process.env.CLIENT_URL,
    ].filter(Boolean);

    // Origin yo'q (curl, Postman) yoki ruxsat berilgan
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Development uchun barchasiga ruxsat
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ OPTIONS preflight uchun
app.options('*', cors());

app.use(express.json());

app.use('/api/auth',     authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/shop',     shopRoutes);
app.use('/api/quizzes',  quizRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});