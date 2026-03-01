// routes/auth.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * Generates a JSON Web Token (JWT) for a given user ID.
 *
 * The generated token will contain the user ID and will be signed with the JWT secret.
 * The token will expire after 30 days.
 *
 * @param {string} id The user ID to encode in the token.
 * @returns {string} The generated JWT token.
 */
const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── POST /api/auth/login ─────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { login, email, password } = req.body;
    
    // Support login with either 'login' (username) or 'email'
    let user;
    if (login) {
      user = await User.findOne({ login });
    } else if (email) {
      user = await User.findOne({ email });
    }
    
    if (!user) return res.status(401).json({ message: 'Invalid login or password' });

    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid login or password' });

    res.json({ token: genToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/register ──────────────────────
router.post('/register', async (req, res) => {
  try {
    const { login, name, email, password, role, class: cls, avatar, color } = req.body;
    
    if (!login) return res.status(400).json({ message: 'Login (username) is required' });
    
    const existsLogin = await User.findOne({ login });
    if (existsLogin) return res.status(400).json({ message: 'Login already taken' });

    const existsEmail = email ? await User.findOne({ email }) : null;
    if (existsEmail) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      login, 
      name, 
      email, 
      password,
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
    const { login, name, email, password, class: cls, avatar, color } = req.body;

    if (!login || !name || !password) {
      return res.status(400).json({ message: 'Login, name and password are required' });
    }

    const existsLogin = await User.findOne({ login });
    if (existsLogin) return res.status(400).json({ message: 'Login already taken' });

    const existsEmail = email ? await User.findOne({ email }) : null;
    if (existsEmail) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      login,
      name,
      email,
      password,
      role: 'student',
      class: cls || '',
      avatar: avatar || name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      color: color || '#22c55e',
      coins: 0,
      // Assign this teacher as the student's teacher
      teacher: req.user._id,
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


