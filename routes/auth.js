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

    console.log('Create student request body:', JSON.stringify(req.body));

    if (!name || !email || !password) {
      const missing = [];
      if (!name) missing.push('name');
      if (!email) missing.push('email');
      if (!password) missing.push('password');
      console.log('Missing required fields:', missing);
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      console.log('Email already exists:', email);
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'student',
      class: cls || '',
      teacher: req.user._id,
      avatar: avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      color: color || '#22c55e',
      coins: 0,
    });

    console.log('Student created successfully:', user._id);
    res.status(201).json({ user });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/me ─────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// ── PUT /api/auth/profile ─────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, password, avatar, color } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (color) user.color = color;
    
    // Only update avatar if it's explicitly provided and not empty
    // Don't overwrite uploaded image with empty string
    if (avatar !== undefined && avatar !== null && avatar !== '') {
      // If it's a new value (different from current), use it
      // Otherwise keep the existing uploaded image
      if (avatar !== user.avatar) {
        user.avatar = avatar;
      }
    }
    
    if (password) user.password = password;
    
    await user.save();
    
    // Return fresh user data
    const freshUser = await User.findById(req.user._id);
    res.json(freshUser.toJSON());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
