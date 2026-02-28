// routes/auth.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── POST /api/auth/login ─────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: genToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/register ──────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, class: cls, avatar, color } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name, email, password,
      role: role || 'student',
      class: cls || '',
      avatar: avatar || name.split(' ').map(n => n[0]).join('').toUpperCase(),
      color: color || '#22c55e',
      coins: 0,
    });

    res.status(201).json({ token: genToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/create-student ── Teacher creates student account
router.post('/create-student', protect, teacherOnly, async (req, res) => {
  try {
    const { name, email, password, class: cls, avatar, color } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      class: cls || '',
      avatar: avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      color: color || '#22c55e',
      coins: 0,
    });

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
