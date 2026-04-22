const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `avatar-${req.user._id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }

    cb(null, true);
  },
});

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: genToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, password, class: cls, avatar, color } = req.body;
    const email = req.body.email?.toLowerCase().trim();
    const exists = await User.findOne({ email });

    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      class: cls || '',
      avatar: avatar || name.split(' ').map((part) => part[0]).join('').toUpperCase(),
      color: color || '#22c55e',
      coins: 0,
    });

    res.status(201).json({ token: genToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/create-student', protect, teacherOnly, async (req, res) => {
  try {
    const { name, email, password, class: cls, avatar, color } = req.body;

    if (!name || !email || !password) {
      const missing = [];
      if (!name) missing.push('name');
      if (!email) missing.push('email');
      if (!password) missing.push('password');
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'student',
      class: cls || '',
      teacher: req.user._id,
      avatar: avatar || name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2),
      color: color || '#22c55e',
      coins: 0,
    });

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

router.post('/upload-avatar', protect, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Avatar file is required' });
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.avatar?.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', user.avatar.replace(/^\/+/, ''));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      user.avatar = `/uploads/${req.file.filename}`;
      await user.save();

      res.status(201).json({ avatar: user.avatar, user: user.toJSON() });
    } catch (uploadErr) {
      res.status(500).json({ message: uploadErr.message });
    }
  });
});

router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, password, avatar, color } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const normalizedEmail = email?.toLowerCase().trim();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const exists = await User.findOne({ email: normalizedEmail });
      if (exists) return res.status(400).json({ message: 'Email already in use' });
    }

    if (name) user.name = name;
    if (normalizedEmail) user.email = normalizedEmail;
    if (color) user.color = color;

    if (avatar !== undefined && avatar !== null && avatar !== '' && avatar !== user.avatar) {
      user.avatar = avatar;
    }

    if (password) user.password = password;

    await user.save();

    const freshUser = await User.findById(req.user._id);
    res.json(freshUser.toJSON());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
