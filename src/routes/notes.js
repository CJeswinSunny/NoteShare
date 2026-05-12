const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) { req.session.error = 'Please log in to continue.'; return res.redirect('/login'); }
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
});

const ALLOWED = {
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image'
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('File type not allowed.'))
});

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','Computer Science','English','History',
  'Geography','Economics','Business Studies','Accounting','Psychology','Sociology',
  'Political Science','Philosophy','Art','Music','Physical Education','Other'];

// GET /dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
  const { search, subject } = req.query;
  try {
    let sql = `SELECT notes.*, users.name as uploader_name, users.avatar_color FROM notes JOIN users ON notes.uploader_id = users.id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (notes.title LIKE ? OR notes.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (subject) { sql += ' AND notes.subject = ?'; params.push(subject); }
    sql += ' ORDER BY notes.created_at DESC';
    const [notes, total, myUploads, myDl] = await Promise.all([
      db.allSync(sql, ...params),
      db.getSync('SELECT COUNT(*) as c FROM notes'),
      db.getSync('SELECT COUNT(*) as c FROM notes WHERE uploader_id = ?', req.session.user.id),
      db.getSync('SELECT SUM(downloads) as s FROM notes WHERE uploader_id = ?', req.session.user.id),
    ]);
    const stats = { totalNotes: total.c, myUploads: myUploads.c, totalDownloads: myDl.s || 0 };
    res.render('dashboard', { notes, stats, subjects: SUBJECTS, search: search || '', subject: subject || '' });
  } catch (e) { console.error(e); res.render('error', { message: 'Could not load dashboard.' }); }
});

// GET /upload
router.get('/upload', requireAuth, (req, res) => res.render('upload', { subjects: SUBJECTS, error: null }));

// POST /upload
router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.render('upload', { subjects: SUBJECTS, error: err.message });
    if (!req.file) return res.render('upload', { subjects: SUBJECTS, error: 'Please select a file.' });
    const { title, subject, description } = req.body;
    if (!title || !subject) {
      fs.unlinkSync(req.file.path);
      return res.render('upload', { subjects: SUBJECTS, error: 'Title and subject are required.' });
    }
    try {
      await db.runSync(
        'INSERT INTO notes (title, subject, description, filename, original_name, file_type, file_size, uploader_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        title.trim(), subject, description?.trim() || '', req.file.filename, req.file.originalname,
        ALLOWED[req.file.mimetype] || 'other', req.file.size, req.session.user.id
      );
      req.session.success = 'Note uploaded successfully!';
      res.redirect('/dashboard');
    } catch (e) { res.render('upload', { subjects: SUBJECTS, error: 'Upload failed. Please try again.' }); }
  });
});

// GET /download/:id
router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const note = await db.getSync('SELECT * FROM notes WHERE id = ?', req.params.id);
    if (!note) return res.status(404).render('error', { message: 'Note not found.' });
    const filePath = path.join(__dirname, '..', '..', 'uploads', note.filename);
    if (!fs.existsSync(filePath)) return res.status(404).render('error', { message: 'File not found on server.' });
    await db.runSync('UPDATE notes SET downloads = downloads + 1 WHERE id = ?', note.id);
    res.download(filePath, note.original_name);
  } catch (e) { res.render('error', { message: 'Download failed.' }); }
});

// GET /note/:id
router.get('/note/:id', requireAuth, async (req, res) => {
  try {
    const note = await db.getSync(
      'SELECT notes.*, users.name as uploader_name, users.avatar_color FROM notes JOIN users ON notes.uploader_id = users.id WHERE notes.id = ?',
      req.params.id
    );
    if (!note) return res.status(404).render('error', { message: 'Note not found.' });
    res.render('note-detail', { note });
  } catch (e) { res.render('error', { message: 'Could not load note.' }); }
});

// POST /note/:id/delete
router.post('/note/:id/delete', requireAuth, async (req, res) => {
  try {
    const note = await db.getSync('SELECT * FROM notes WHERE id = ? AND uploader_id = ?', req.params.id, req.session.user.id);
    if (!note) return res.status(403).render('error', { message: 'Unauthorized.' });
    const fp = path.join(__dirname, '..', '..', 'uploads', note.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    await db.runSync('DELETE FROM notes WHERE id = ?', note.id);
    req.session.success = 'Note deleted.';
    res.redirect('/my-notes');
  } catch (e) { res.render('error', { message: 'Delete failed.' }); }
});

// GET /my-notes
router.get('/my-notes', requireAuth, async (req, res) => {
  try {
    const notes = await db.allSync(
      'SELECT notes.*, users.name as uploader_name, users.avatar_color FROM notes JOIN users ON notes.uploader_id = users.id WHERE notes.uploader_id = ? ORDER BY notes.created_at DESC',
      req.session.user.id
    );
    const totalDownloads = notes.reduce((s, n) => s + n.downloads, 0);
    res.render('my-notes', { notes, totalDownloads });
  } catch (e) { res.render('error', { message: 'Could not load your notes.' }); }
});

module.exports = router;
