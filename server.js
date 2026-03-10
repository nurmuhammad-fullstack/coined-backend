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

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      callback(null, true);
    } else {
      callback(null, true); // development: barchasiga ruxsat
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
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