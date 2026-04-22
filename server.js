require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { initializeSocket } = require('./services/socket');

// Import bot - starts automatically when server starts
require('./bot');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const shopRoutes = require('./routes/shop');
const quizRoutes = require('./routes/quizzes');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const classesRoutes = require('./routes/classes');
const contactRoutes = require('./routes/contact');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const server = http.createServer(app);

connectDB();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set(
  [process.env.CLIENT_URL, process.env.WEBAPP_URL].filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const isAllowedVercel = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

    if (isLocalhost || isAllowedVercel || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/schedule', scheduleRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    credentials: true,
  },
});

initializeSocket(io);
app.set('io', io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`CoinEd API running on http://localhost:${PORT}`);
});
