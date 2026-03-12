// server.js
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');

// Import bot - starts automatically when server starts
require('./bot');

const authRoutes          = require('./routes/auth');
const studentRoutes       = require('./routes/students');
const shopRoutes          = require('./routes/shop');
const quizRoutes          = require('./routes/quizzes');
const chatRoutes          = require('./routes/chat');
const notificationRoutes  = require('./routes/notifications');
const analyticsRoutes     = require('./routes/analytics');
const classesRoutes       = require('./routes/classes');
const contactRoutes       = require('./routes/contact');
const scheduleRoutes      = require('./routes/schedule');

const app = express();

connectDB();

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use('/api/auth',          authRoutes);
app.use('/api/students',      studentRoutes);
app.use('/api/shop',          shopRoutes);
app.use('/api/quizzes',       quizRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/classes',       classesRoutes);
app.use('/api/contact',       contactRoutes);
app.use('/api/schedule',      scheduleRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});