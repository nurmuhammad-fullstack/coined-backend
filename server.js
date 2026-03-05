// server.js
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const http       = require('http');
const { Server } = require('socket.io');
const connectDB  = require('./config/db');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/students');
const shopRoutes    = require('./routes/shop');
const quizRoutes    = require('./routes/quizzes');
const notifRoutes   = require('./routes/notifications');
const classRoutes   = require('./routes/classes');
const analyticsRoutes = require('./routes/analytics');
const chatRoutes   = require('./routes/chat');
const contactRoutes = require('./routes/contact');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store io instance for use in routes
app.set('io', io);

// ── Connect MongoDB ──────────────────────────────
connectDB();

// ── CORS ─────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ── Static folder for uploads ────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// ── Serve uploaded images with proper headers ──────
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(uploadsDir));

// ── Multer config for profile images ────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

// ── Routes ───────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/students',    studentRoutes);
app.use('/api/shop',        shopRoutes);
app.use('/api/quizzes',     quizRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/classes',     classRoutes);
app.use('/api/analytics',   analyticsRoutes);
app.use('/api/chat',        chatRoutes);
app.use('/api/contact',     contactRoutes);

// ── Profile image upload endpoint ───────────────
app.post('/api/auth/upload-avatar', require('./middleware/auth').protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    
    const User = require('./models/User');
    const user = await User.findById(req.user._id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Delete old avatar if it's a file (not a color code)
    if (user.avatar && !user.avatar.startsWith('#') && user.avatar.includes('/uploads')) {
      const oldPath = path.join(__dirname, user.avatar.replace('/uploads', 'uploads'));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    
    user.avatar = `/uploads/${req.file.filename}`;
    await user.save();
    
    // Return fresh user data with full avatar URL
    const freshUser = await User.findById(req.user._id);
    res.json({ avatar: freshUser.avatar, user: freshUser.toJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Health check ─────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Start Telegram Bot ───────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN) {
  require('./bot');
  console.log('🤖 Telegram Bot started!');
} else {
  console.log('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled');
}

// ── Initialize Socket.io ─────────────────────────
const { initializeSocket } = require('./services/socket');
initializeSocket(io);
console.log('🔌 Socket.io initialized!');

// ── Start server ─────────────────────────────────
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 CoinEd API running on http://localhost:${PORT}`);
});
