const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const router = express.Router();

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6','#ef4444'];

function requireGuest(req, res, next) {
  if (req.session.user) return res.redirect('/dashboard');
  next();
}

// GET /
router.get('/', async (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  try {
    const [n, u, d] = await Promise.all([
      db.getSync('SELECT COUNT(*) as c FROM notes'),
      db.getSync('SELECT COUNT(*) as c FROM users'),
      db.getSync('SELECT SUM(downloads) as s FROM notes'),
    ]);
    res.render('landing', { stats: { totalNotes: n.c, totalUsers: u.c, totalDownloads: d.s || 0 } });
  } catch (e) { res.render('landing', { stats: { totalNotes: 0, totalUsers: 0, totalDownloads: 0 } }); }
});

// GET /login
router.get('/login', requireGuest, (req, res) => res.render('auth/login', { error: null }));

// POST /login
router.post('/login', requireGuest, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.render('auth/login', { error: 'Please fill in all fields.' });
  try {
    const user = await db.getSync('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.render('auth/login', { error: 'Invalid email or password.' });
    req.session.user = { id: user.id, name: user.name, email: user.email, avatar_color: user.avatar_color };
    req.session.success = `Welcome back, ${user.name}!`;
    res.redirect('/dashboard');
  } catch (e) { res.render('auth/login', { error: 'Something went wrong. Please try again.' }); }
});

// GET /register
router.get('/register', requireGuest, (req, res) => res.render('auth/register', { error: null }));

// POST /register
router.post('/register', requireGuest, async (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  if (!name || !email || !password || !confirm_password)
    return res.render('auth/register', { error: 'Please fill in all fields.' });
  if (password !== confirm_password)
    return res.render('auth/register', { error: 'Passwords do not match.' });
  if (password.length < 6)
    return res.render('auth/register', { error: 'Password must be at least 6 characters.' });
  try {
    const existing = await db.getSync('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
    if (existing) return res.render('auth/register', { error: 'An account with that email already exists.' });
    const hashed = bcrypt.hashSync(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const result = await db.runSync(
      'INSERT INTO users (name, email, password, avatar_color) VALUES (?, ?, ?, ?)',
      name.trim(), email.toLowerCase().trim(), hashed, color
    );
    req.session.user = { id: result.lastID, name: name.trim(), email: email.toLowerCase().trim(), avatar_color: color };
    req.session.success = `Welcome to NoteShare, ${name.trim()}!`;
    res.redirect('/dashboard');
  } catch (e) { res.render('auth/register', { error: 'Something went wrong. Please try again.' }); }
});

// POST /logout
router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

module.exports = router;
