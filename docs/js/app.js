'use strict';
// ============================================================
//  NoteShare – Static SPA (GitHub Pages)
//  Storage: localStorage (metadata) + IndexedDB (files)
// ============================================================

// ── CONSTANTS ────────────────────────────────────────────────
const LS_USERS   = 'ns_users';
const LS_NOTES   = 'ns_notes';
const LS_SESSION = 'ns_session';
const IDB_NAME   = 'noteshare_files';
const IDB_STORE  = 'files';

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','Computer Science',
  'English','History','Geography','Economics','Business Studies','Accounting',
  'Psychology','Sociology','Political Science','Philosophy','Art','Music',
  'Physical Education','Other'];

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6','#ef4444'];

const FILE_TYPES = {
  'application/pdf':'pdf',
  'application/msword':'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
  'application/vnd.ms-powerpoint':'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx',
  'text/plain':'txt',
  'image/jpeg':'image','image/png':'image','image/gif':'image','image/webp':'image'
};

const TYPE_META = {
  pdf:  {color:'#ef4444', bg:'rgba(239,68,68,0.12)',    label:'PDF'},
  doc:  {color:'#3b82f6', bg:'rgba(59,130,246,0.12)',   label:'DOC'},
  docx: {color:'#3b82f6', bg:'rgba(59,130,246,0.12)',   label:'DOCX'},
  ppt:  {color:'#f59e0b', bg:'rgba(245,158,11,0.12)',   label:'PPT'},
  pptx: {color:'#f59e0b', bg:'rgba(245,158,11,0.12)',   label:'PPTX'},
  txt:  {color:'#10b981', bg:'rgba(16,185,129,0.12)',   label:'TXT'},
  image:{color:'#8b5cf6', bg:'rgba(139,92,246,0.12)',   label:'IMG'},
};

// ── INDEXEDDB ────────────────────────────────────────────────
let _idb = null;
function openIDB() {
  return new Promise((res, rej) => {
    if (_idb) return res(_idb);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbPut(key, val) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}
async function idbGet(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const r = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get(key);
    r.onsuccess = e => res(e.target.result); r.onerror = e => rej(e.target.error);
  });
}
async function idbDel(key) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

// ── LOCAL STORAGE ─────────────────────────────────────────────
const ls = {
  get:     k  => JSON.parse(localStorage.getItem(k) || 'null'),
  set:     (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  users:   () => ls.get(LS_USERS)   || [],
  notes:   () => ls.get(LS_NOTES)   || [],
  session: () => ls.get(LS_SESSION),
};

// ── CRYPTO ────────────────────────────────────────────────────
async function hashPw(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── AUTH ──────────────────────────────────────────────────────
function currentUser() { return ls.session(); }

async function registerUser(name, email, password) {
  const users = ls.users();
  if (users.find(u => u.email === email.toLowerCase().trim()))
    throw new Error('An account with that email already exists.');
  const hash = await hashPw(password);
  const user = {
    id: Date.now().toString(), name: name.trim(),
    email: email.toLowerCase().trim(), passwordHash: hash,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)],
    createdAt: new Date().toISOString()
  };
  users.push(user); ls.set(LS_USERS, users);
  const sess = {id:user.id, name:user.name, email:user.email, avatarColor:user.avatarColor};
  ls.set(LS_SESSION, sess);
  return sess;
}

async function loginUser(email, password) {
  const user = ls.users().find(u => u.email === email.toLowerCase().trim());
  if (!user) throw new Error('Invalid email or password.');
  const hash = await hashPw(password);
  if (hash !== user.passwordHash) throw new Error('Invalid email or password.');
  const sess = {id:user.id, name:user.name, email:user.email, avatarColor:user.avatarColor};
  ls.set(LS_SESSION, sess);
  return sess;
}

function logoutUser() { localStorage.removeItem(LS_SESSION); navigate('/'); }

// ── NOTES ─────────────────────────────────────────────────────
function getNotes(search='', subject='') {
  let notes = ls.notes();
  if (search) {
    const q = search.toLowerCase();
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(q) || (n.description||'').toLowerCase().includes(q));
  }
  if (subject) notes = notes.filter(n => n.subject === subject);
  return notes.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
}
function getNote(id) { return ls.notes().find(n => n.id === id); }
function getUploaderName(uploaderId) {
  const u = ls.users().find(u => u.id === uploaderId);
  return u ? u.name : 'Unknown';
}
function getUploaderColor(uploaderId) {
  const u = ls.users().find(u => u.id === uploaderId);
  return u ? u.avatarColor : '#6366f1';
}

async function saveNote(meta, fileBuffer, mimeType) {
  const notes = ls.notes();
  const id = Date.now().toString();
  const note = {...meta, id, downloads:0, createdAt: new Date().toISOString()};
  notes.push(note); ls.set(LS_NOTES, notes);
  await idbPut(id, {buffer: fileBuffer, mimeType});
  return note;
}

async function deleteNote(id) {
  ls.set(LS_NOTES, ls.notes().filter(n => n.id !== id));
  await idbDel(id);
}

function incrementDownload(id) {
  const notes = ls.notes();
  const n = notes.find(n => n.id === id);
  if (n) { n.downloads++; ls.set(LS_NOTES, notes); }
}

async function downloadNote(id) {
  const note = getNote(id);
  if (!note) return;
  const data = await idbGet(id);
  if (!data) { showToast('File not found. It may have been cleared from browser storage.','error'); return; }
  incrementDownload(id);
  const blob = new Blob([data.buffer], {type: data.mimeType});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = note.originalName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── ROUTER ───────────────────────────────────────────────────
function navigate(path) { window.location.hash = '#' + path; }
function getRoute()     { return window.location.hash.slice(1) || '/'; }
window.addEventListener('hashchange', render);

// ── HELPERS ──────────────────────────────────────────────────
const fmt     = b => b>1024*1024 ? (b/1024/1024).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';
const fmtDate = s => new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const esc     = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ftMeta  = t => TYPE_META[t] || {color:'#6366f1', bg:'rgba(99,102,241,0.12)', label:'FILE'};

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, type='success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const d = document.createElement('div');
  d.className = `toast toast-${type}`;
  d.innerHTML = (type==='success'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`)
    + esc(msg);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

// ── GLOBAL HANDLERS (called from inline HTML) ─────────────────
window.logoutUser      = logoutUser;
window.toggleNav       = () => document.getElementById('navLinks')?.classList.toggle('open');
window.togglePw        = (id, btn) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type==='password' ? 'text' : 'password';
  btn.style.color = el.type==='text' ? 'var(--primary)' : '';
};
window.updateStrength  = v => {
  const el = document.getElementById('pwStrength'); if (!el) return;
  let s=0; if(v.length>=6)s++; if(v.length>=10)s++; if(/[A-Z]/.test(v))s++;
  if(/[0-9]/.test(v))s++; if(/[^A-Za-z0-9]/.test(v))s++;
  const c=['#ef4444','#f59e0b','#f59e0b','#10b981','#10b981'];
  const w=['20%','40%','60%','80%','100%'];
  el.innerHTML = v ? `<div class="pw-strength-bar" style="width:${w[s-1]||'10%'};background:${c[s-1]||'#ef4444'}"></div>` : '';
};
window.clearSearch = () => {
  document.getElementById('searchInput').value='';
  document.getElementById('subjectFilter').value='';
  renderDashboard('','');
};
window.doSearch = () => {
  const s = document.getElementById('searchInput')?.value||'';
  const j = document.getElementById('subjectFilter')?.value||'';
  renderDashboard(s,j);
};
window.downloadNote = downloadNote;
window.deleteOwnNote = async (id) => {
  if (!confirm('Delete this note permanently?')) return;
  await deleteNote(id);
  showToast('Note deleted.');
  navigate('/my-notes');
};
window.handleLogin = async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('authError');
  const email = document.getElementById('email').value;
  const pw    = document.getElementById('password').value;
  btn.disabled=true; btn.querySelector('span').textContent='Signing in…';
  err.style.display='none';
  try {
    await loginUser(email, pw);
    showToast('Welcome back!');
    navigate('/dashboard');
  } catch(ex) {
    err.textContent = ex.message; err.style.display='flex';
    btn.disabled=false; btn.querySelector('span').textContent='Sign In';
  }
};
window.handleRegister = async e => {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  const err = document.getElementById('authError');
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const pw  = document.getElementById('password').value;
  const pw2 = document.getElementById('confirm_password').value;
  err.style.display='none';
  if (pw !== pw2) { err.textContent='Passwords do not match.'; err.style.display='flex'; return; }
  if (pw.length < 6) { err.textContent='Password must be at least 6 characters.'; err.style.display='flex'; return; }
  btn.disabled=true; btn.querySelector('span').textContent='Creating account…';
  try {
    await registerUser(name, email, pw);
    showToast('Welcome to NoteShare!');
    navigate('/dashboard');
  } catch(ex) {
    err.textContent = ex.message; err.style.display='flex';
    btn.disabled=false; btn.querySelector('span').textContent='Create Account';
  }
};
window.handleUpload = async e => {
  e.preventDefault();
  const err = document.getElementById('uploadError');
  const btn = document.getElementById('uploadBtn');
  err.style.display='none';
  const file    = document.getElementById('fileInput').files[0];
  const title   = document.getElementById('title').value.trim();
  const subject = document.getElementById('subject').value;
  const desc    = document.getElementById('description').value.trim();
  if (!file)    { err.textContent='Please select a file.'; err.style.display='flex'; return; }
  if (!title)   { err.textContent='Title is required.'; err.style.display='flex'; return; }
  if (!subject) { err.textContent='Please select a subject.'; err.style.display='flex'; return; }
  const fileType = FILE_TYPES[file.type] || 'other';
  btn.disabled=true; btn.innerHTML='<span>Uploading…</span>';
  try {
    const buffer = await file.arrayBuffer();
    const user = currentUser();
    await saveNote({
      title, subject, description:desc,
      originalName: file.name, fileType, fileSize: file.size,
      uploaderId: user.id, uploaderName: user.name, uploaderColor: user.avatarColor
    }, buffer, file.type);
    showToast('Note uploaded successfully!');
    navigate('/dashboard');
  } catch(ex) {
    err.textContent='Upload failed: '+ex.message; err.style.display='flex';
    btn.disabled=false; btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Upload Note';
  }
};
window.initDropZone = () => {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  const btn   = document.getElementById('uploadBtn');
  if (!zone || !input) return;
  const show = file => {
    document.getElementById('dropContent').classList.add('hidden');
    document.getElementById('filePreview').classList.remove('hidden');
    document.getElementById('previewName').textContent = file.name;
    document.getElementById('previewSize').textContent = fmt(file.size);
    const icons = {'application/pdf':'📄','text/plain':'📃','image/jpeg':'🖼️','image/png':'🖼️','image/gif':'🖼️','image/webp':'🖼️'};
    document.getElementById('previewIcon').textContent = icons[file.type] || '📁';
    btn.removeAttribute('disabled');
  };
  input.addEventListener('change', () => { if(input.files[0]) show(input.files[0]); });
  document.getElementById('removeFile')?.addEventListener('click', () => {
    input.value='';
    document.getElementById('dropContent').classList.remove('hidden');
    document.getElementById('filePreview').classList.add('hidden');
    btn.setAttribute('disabled','true');
  });
  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('dragging'); }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('dragging'); }));
  zone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) { const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files; show(file); }
  });
  document.getElementById('description')?.addEventListener('input', function() {
    document.getElementById('charCounter').textContent = `${this.value.length} / 500`;
  });
};

// -- NAVBAR ---------------------------------------------------
function navHTML() {
  const u = currentUser();
  return `<nav class="navbar"><div class="container nav-container">
    <a href="#/" class="nav-brand"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="url(#nbg)"/><path d="M8 10h16M8 16h12M8 22h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/><defs><linearGradient id="nbg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg><span>NoteShare</span></a>
    <div class="nav-links" id="navLinks">${u?`
      <a href="#/dashboard" class="nav-link">Browse</a>
      <a href="#/my-notes" class="nav-link">My Notes</a>
      <a href="#/upload" class="nav-btn-outline">Upload</a>
      <div class="nav-user"><div class="avatar-sm" style="background:${u.avatarColor}">${u.name.charAt(0).toUpperCase()}</div>
      <span class="nav-username">${esc(u.name.split(' ')[0])}</span>
      <div class="nav-dropdown"><button class="dropdown-item danger" onclick="logoutUser()">Sign out</button></div></div>`
    :`<a href="#/login" class="nav-link">Sign in</a><a href="#/register" class="nav-btn">Get Started</a>`}
    </div>
    <button class="hamburger" onclick="toggleNav()"><span></span><span></span><span></span></button>
  </div></nav>`;
}

// -- NOTE CARD -------------------------------------------------
function noteCardHTML(n) {
  const ft = ftMeta(n.fileType);
  const name = n.uploaderName || getUploaderName(n.uploaderId);
  const color = n.uploaderColor || getUploaderColor(n.uploaderId);
  return `<article class="note-card">
    <div class="note-card-header">
      <div class="file-badge" style="color:${ft.color};background:${ft.bg}">${ft.label}</div>
      <div class="note-subject-tag">${esc(n.subject)}</div>
    </div>
    <div class="note-card-body">
      <h3 class="note-title"><a href="#/note/${n.id}">${esc(n.title)}</a></h3>
      ${n.description?`<p class="note-desc">${esc(n.description.substring(0,100))}${n.description.length>100?'�':''}</p>`:''}
    </div>
    <div class="note-card-footer">
      <div class="note-meta">
        <div class="uploader-info"><div class="avatar-xs" style="background:${color}">${name.charAt(0).toUpperCase()}</div><span>${esc(name.split(' ')[0])}</span></div>
        <span class="meta-dot">�</span><span>${fmtDate(n.createdAt)}</span>
      </div>
      <div class="note-actions-row">
        <span class="dl-count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${n.downloads}</span>
        <span class="file-size-label">${fmt(n.fileSize)}</span>
        <button class="btn-dl" onclick="downloadNote('${n.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Download</button>
      </div>
    </div>
  </article>`;
}

// -- VIEWS ----------------------------------------------------
function viewLanding() {
  const notes=ls.notes(), users=ls.users(), totalDl=notes.reduce((s,n)=>s+n.downloads,0);
  return navHTML()+`<main>
  <section class="hero"><div class="hero-bg"></div><div class="hero-orb orb-1"></div><div class="hero-orb orb-2"></div>
  <div class="container hero-content">
    <div class="hero-badge">? Free for all students</div>
    <h1 class="hero-title">Share knowledge,<br><span class="gradient-text">ace every exam.</span></h1>
    <p class="hero-desc">NoteShare is the student-first platform to upload, discover, and download class notes, slides, and study materials � all in one place.</p>
    <div class="hero-actions"><a href="#/register" class="btn btn-primary btn-lg">Get Started Free</a><a href="#/login" class="btn btn-outline btn-lg">Sign In</a></div>
    <div class="hero-stats">
      <div class="stat-item"><span class="stat-num">${notes.length}+</span><span class="stat-label">Notes Shared</span></div>
      <div class="stat-divider"></div>
      <div class="stat-item"><span class="stat-num">${users.length}+</span><span class="stat-label">Students</span></div>
      <div class="stat-divider"></div>
      <div class="stat-item"><span class="stat-num">${totalDl}+</span><span class="stat-label">Downloads</span></div>
    </div>
  </div></section>
  <section class="features section"><div class="container">
    <div class="section-header"><h2>Everything you need to <span class="gradient-text">study smarter</span></h2><p>Built for students, by students.</p></div>
    <div class="features-grid">
      ${[['linear-gradient(135deg,#6366f1,#8b5cf6)','Drag & Drop Upload','Upload PDF, DOCX, PPT, TXT and images instantly.'],
         ['linear-gradient(135deg,#14b8a6,#10b981)','Smart Search & Filter','Find notes by title, description, or subject.'],
         ['linear-gradient(135deg,#f59e0b,#ef4444)','One-Click Download','Download any note file instantly.'],
         ['linear-gradient(135deg,#ec4899,#8b5cf6)','Download Analytics','See how many times your notes were downloaded.'],
         ['linear-gradient(135deg,#3b82f6,#6366f1)','Works Offline','Files stored in your browser � no server needed.'],
         ['linear-gradient(135deg,#10b981,#3b82f6)','Community Driven','A growing library of notes shared by students.'],
      ].map(([g,t,d])=>`<div class="feature-card"><div class="feature-icon" style="background:${g}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div></section>
  <section class="cta section"><div class="container"><div class="cta-card"><div class="cta-orb"></div>
    <h2>Ready to start sharing?</h2><p>Join students already using NoteShare to study smarter.</p>
    <a href="#/register" class="btn btn-white btn-lg">Create Free Account</a>
  </div></div></section>
  <footer class="footer"><div class="container footer-inner">
    <div class="nav-brand"><svg width="22" height="22" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="url(#fg)"/><path d="M8 10h16M8 16h12M8 22h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/><defs><linearGradient id="fg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg><span>NoteShare</span></div>
    <p class="footer-copy">&copy; ${new Date().getFullYear()} NoteShare. Runs entirely in your browser.</p>
  </div></footer></main>`;
}

function viewLogin() {
  return navHTML()+`<main class="auth-main">
  <div class="auth-orb auth-orb-1"></div><div class="auth-orb auth-orb-2"></div>
  <div class="auth-container"><div class="auth-card">
    <div class="auth-logo"><svg width="36" height="36" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="url(#alg)"/><path d="M8 10h16M8 16h12M8 22h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/><defs><linearGradient id="alg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg> NoteShare</div>
    <h1 class="auth-title">Welcome back</h1><p class="auth-subtitle">Sign in to your account to continue</p>
    <div id="authError" class="alert alert-error" style="display:none"></div>
    <form class="auth-form" onsubmit="handleLogin(event)">
      <div class="form-group"><label>Email address</label><input type="email" id="email" placeholder="you@university.edu" required></div>
      <div class="form-group"><label>Password</label><div class="input-wrapper"><input type="password" id="password" placeholder="Your password" required><button type="button" class="toggle-pw" onclick="togglePw('password',this)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg></button></div></div>
      <button type="submit" class="btn btn-primary btn-full" id="loginBtn"><span>Sign In</span></button>
    </form>
    <p class="auth-switch">Don't have an account? <a href="#/register">Create one free</a></p>
  </div></div></main>`;
}

function viewRegister() {
  return navHTML()+`<main class="auth-main">
  <div class="auth-orb auth-orb-1"></div><div class="auth-orb auth-orb-2"></div>
  <div class="auth-container"><div class="auth-card">
    <div class="auth-logo"><svg width="36" height="36" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="url(#arg)"/><path d="M8 10h16M8 16h12M8 22h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/><defs><linearGradient id="arg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg> NoteShare</div>
    <h1 class="auth-title">Create your account</h1><p class="auth-subtitle">Join the student knowledge community</p>
    <div id="authError" class="alert alert-error" style="display:none"></div>
    <form class="auth-form" onsubmit="handleRegister(event)">
      <div class="form-group"><label>Full name</label><input type="text" id="name" placeholder="Alex Johnson" required></div>
      <div class="form-group"><label>Email address</label><input type="email" id="email" placeholder="you@university.edu" required></div>
      <div class="form-group"><label>Password</label><div class="input-wrapper"><input type="password" id="password" placeholder="At least 6 characters" required oninput="updateStrength(this.value)"><button type="button" class="toggle-pw" onclick="togglePw('password',this)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg></button></div><div class="pw-strength" id="pwStrength"></div></div>
      <div class="form-group"><label>Confirm password</label><div class="input-wrapper"><input type="password" id="confirm_password" placeholder="Repeat your password" required><button type="button" class="toggle-pw" onclick="togglePw('confirm_password',this)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg></button></div></div>
      <button type="submit" class="btn btn-primary btn-full" id="registerBtn"><span>Create Account</span></button>
    </form>
    <p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
  </div></div></main>`;
}

function viewDashboard(search='',subject='') {
  const notes=getNotes(search,subject), allNotes=ls.notes(), user=currentUser();
  const myUploads=allNotes.filter(n=>n.uploaderId===user.id).length;
  const myDl=allNotes.filter(n=>n.uploaderId===user.id).reduce((s,n)=>s+n.downloads,0);
  return navHTML()+`<main class="app-main"><div class="container">
  <div class="page-header"><div><h1 class="page-title">Browse Notes</h1><p class="page-sub">Discover notes shared by the community</p></div>
    <a href="#/upload" class="btn btn-primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Upload Note</a></div>
  <div class="stats-bar">
    <div class="stat-pill"><strong>${allNotes.length}</strong> Total Notes</div>
    <div class="stat-pill"><strong>${myUploads}</strong> My Uploads</div>
    <div class="stat-pill"><strong>${myDl}</strong> My Downloads Generated</div>
  </div>
  <div class="search-bar-wrap"><div class="search-form">
    <div class="search-input-wrap"><svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input type="text" id="searchInput" class="search-input" placeholder="Search notes by title or description�" value="${esc(search)}" oninput="doSearch()"></div>
    <select id="subjectFilter" class="subject-select" onchange="doSearch()">
      <option value="">All Subjects</option>
      ${SUBJECTS.map(s=>`<option value="${s}"${subject===s?' selected':''}>${s}</option>`).join('')}
    </select>
    ${search||subject?`<button class="btn btn-ghost" onclick="clearSearch()">Clear</button>`:''}
  </div></div>
  ${search||subject?`<div class="filter-tags"><span class="filter-label">Filtered:</span>${search?`<span class="filter-tag">"${esc(search)}"</span>`:''} ${subject?`<span class="filter-tag subject-tag">${esc(subject)}</span>`:''}<span class="filter-count">${notes.length} result${notes.length!==1?'s':''}</span></div>`:''}
  ${notes.length===0?`<div class="empty-state"><div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>${search||subject?'No notes found':'No notes yet'}</h3><p>${search||subject?'Try adjusting your search.':'Be the first to share a note!'}</p><a href="#/upload" class="btn btn-primary">Upload First Note</a></div>`
  :`<div class="notes-grid">${notes.map(n=>noteCardHTML(n)).join('')}</div>`}
  </div></main>`;
}

function viewUpload() {
  return navHTML()+`<main class="app-main"><div class="container upload-container">
  <div class="page-header"><div><h1 class="page-title">Upload a Note</h1><p class="page-sub">Share your knowledge with the community</p></div></div>
  <div class="upload-layout">
    <div class="upload-card">
      <div id="uploadError" class="alert alert-error" style="display:none"></div>
      <form onsubmit="handleUpload(event)">
        <div class="drop-zone" id="dropZone">
          <div class="drop-zone-content" id="dropContent">
            <div class="drop-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="url(#dg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="dg" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg></div>
            <p class="drop-title">Drag & drop your file here</p><p class="drop-sub">or click to browse</p>
            <p class="drop-types">PDF � DOC � PPT � TXT � Images � Max 50 MB</p>
          </div>
          <div class="file-preview hidden" id="filePreview">
            <div class="file-preview-icon" id="previewIcon"></div>
            <div class="file-preview-info"><span class="file-preview-name" id="previewName"></span><span class="file-preview-size" id="previewSize"></span></div>
            <button type="button" class="file-preview-remove" id="removeFile">?</button>
          </div>
          <input type="file" id="fileInput" class="file-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp">
        </div>
        <div class="form-group"><label>Note Title <span class="req">*</span></label><input type="text" id="title" placeholder="e.g. Chapter 5 � Thermodynamics" required maxlength="120"></div>
        <div class="form-group"><label>Subject <span class="req">*</span></label><select id="subject" required><option value="">Select subject�</option>${SUBJECTS.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Description <span class="opt">(optional)</span></label><textarea id="description" rows="3" placeholder="What does this note cover?" maxlength="500"></textarea><small class="char-counter" id="charCounter">0 / 500</small></div>
        <button type="submit" class="btn btn-primary btn-full" id="uploadBtn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Upload Note
        </button>
      </form>
    </div>
    <div class="upload-sidebar">
      <div class="tips-card"><h3 class="tips-title">Upload Tips</h3><ul class="tips-list">
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Use a clear, descriptive title</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Choose the correct subject</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Add a description for discoverability</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Maximum file size: 50 MB</li>
      </ul></div>
      <div class="supported-formats"><h3 class="tips-title">Supported Formats</h3><div class="format-chips">
        <span class="format-chip pdf">PDF</span><span class="format-chip doc">DOC/DOCX</span>
        <span class="format-chip ppt">PPT/PPTX</span><span class="format-chip txt">TXT</span><span class="format-chip img">Images</span>
      </div></div>
    </div>
  </div></div></main>`;
}

function viewMyNotes() {
  const user=currentUser(), notes=getNotes().filter(n=>n.uploaderId===user.id);
  const totalDl=notes.reduce((s,n)=>s+n.downloads,0);
  return navHTML()+`<main class="app-main"><div class="container">
  <div class="page-header"><div><h1 class="page-title">My Notes</h1><p class="page-sub">Notes you've uploaded to the community</p></div>
    <a href="#/upload" class="btn btn-primary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Upload New</a></div>
  <div class="my-stats-row">
    <div class="my-stat-card"><div class="my-stat-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l5.414 5.414V19a2 2 0 01-2 2z" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div><div><div class="my-stat-value">${notes.length}</div><div class="my-stat-label">Notes Shared</div></div></div>
    <div class="my-stat-card"><div class="my-stat-icon" style="background:linear-gradient(135deg,#10b981,#14b8a6)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><div class="my-stat-value">${totalDl}</div><div class="my-stat-label">Total Downloads</div></div></div>
    <div class="my-stat-card"><div class="my-stat-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888 1.518 4.674c.3.922-.755 1.688-1.538 1.118L12 15.347l-3.976 2.744c-.783.57-1.838-.197-1.538-1.118l1.518-4.674-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><div class="my-stat-value">${notes.length>0?(totalDl/notes.length).toFixed(1):'0'}</div><div class="my-stat-label">Avg Downloads/Note</div></div></div>
  </div>
  ${notes.length===0?`<div class="empty-state"><div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586l5.414 5.414V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>No notes uploaded yet</h3><p>Share your first note and help fellow students!</p><a href="#/upload" class="btn btn-primary">Upload Your First Note</a></div>`
  :`<div class="my-notes-list">${notes.map(n=>{
    const ft=ftMeta(n.fileType);
    return `<div class="my-note-row">
      <div class="my-note-type" style="color:${ft.color};background:${ft.bg}">${ft.label}</div>
      <div class="my-note-info"><a class="my-note-title" href="#/note/${n.id}">${esc(n.title)}</a>
        <div class="my-note-meta"><span class="subject-chip">${esc(n.subject)}</span><span>${fmtDate(n.createdAt)}</span><span>${fmt(n.fileSize)}</span></div></div>
      <div class="my-note-stats"><div class="dl-stat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${n.downloads}</div></div>
      <div class="my-note-actions">
        <button class="btn btn-sm btn-outline" onclick="downloadNote('${n.id}')">Download</button>
        <button class="btn btn-sm btn-danger-outline" onclick="deleteOwnNote('${n.id}')">Delete</button>
      </div></div>`;
  }).join('')}</div>`}
  </div></main>`;
}

function viewNoteDetail(id) {
  const note=getNote(id);
  if (!note) return navHTML()+`<main class="app-main"><div class="container"><div class="error-page"><h1>Not Found</h1><p class="error-msg">This note doesn't exist.</p><a href="#/dashboard" class="btn btn-primary">Back to Browse</a></div></div></main>`;
  const ft=ftMeta(note.fileType), name=note.uploaderName||getUploaderName(note.uploaderId), color=note.uploaderColor||getUploaderColor(note.uploaderId);
  const isOwner=currentUser()&&currentUser().id===note.uploaderId;
  const sizeDisplay=fmt(note.fileSize);
  return navHTML()+`<main class="app-main"><div class="container">
  <div class="breadcrumb"><a href="#/dashboard">Browse</a><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(note.title)}</span></div>
  <div class="note-detail-layout">
    <div class="note-detail-main"><div class="detail-card">
      <div class="detail-header"><div class="file-badge-lg" style="color:${ft.color};background:${ft.bg}">${ft.label}</div><span class="detail-subject">${esc(note.subject)}</span></div>
      <h1 class="detail-title">${esc(note.title)}</h1>
      ${note.description?`<p class="detail-desc">${esc(note.description)}</p>`:''}
      <div class="detail-meta-grid">
        <div class="meta-item"><span class="meta-label">Uploaded by</span><div class="uploader-row"><div class="avatar-sm" style="background:${color}">${name.charAt(0).toUpperCase()}</div><span class="meta-value">${esc(name)}</span></div></div>
        <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${fmtDate(note.createdAt)}</span></div>
        <div class="meta-item"><span class="meta-label">File Size</span><span class="meta-value">${sizeDisplay}</span></div>
        <div class="meta-item"><span class="meta-label">Downloads</span><span class="meta-value dl-highlight">${note.downloads} times</span></div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary btn-lg" onclick="downloadNote('${note.id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Download File</button>
        <a href="#/dashboard" class="btn btn-ghost">? Back to Browse</a>
        ${isOwner?`<button class="btn btn-danger" onclick="deleteOwnNote('${note.id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Delete</button>`:''}
      </div>
    </div></div>
    <div class="note-detail-sidebar"><div class="sidebar-card"><h3>File Info</h3><div class="info-rows">
      <div class="info-row"><span>Type</span><span class="badge-sm" style="color:${ft.color};background:${ft.bg}">${ft.label}</span></div>
      <div class="info-row"><span>Size</span><span>${sizeDisplay}</span></div>
      <div class="info-row"><span>Subject</span><span>${esc(note.subject)}</span></div>
      <div class="info-row"><span>Downloads</span><span>${note.downloads}</span></div>
    </div></div></div>
  </div></div></main>`;
}

// -- RENDER / ROUTER -------------------------------------------
function renderDashboard(search='',subject='') {
  document.getElementById('app').innerHTML = viewDashboard(search,subject);
}

function render() {
  const route = getRoute();
  const user  = currentUser();
  const app   = document.getElementById('app');
  const protectedRoutes = ['/dashboard','/upload','/my-notes'];

  if (protectedRoutes.some(r => route.startsWith(r)) && !user) {
    navigate('/login'); return;
  }
  if ((route==='/login'||route==='/register') && user) {
    navigate('/dashboard'); return;
  }

  if (route==='/'||route==='')             { app.innerHTML=viewLanding(); }
  else if (route==='/login')               { app.innerHTML=viewLogin(); }
  else if (route==='/register')            { app.innerHTML=viewRegister(); }
  else if (route==='/dashboard')           { app.innerHTML=viewDashboard(); }
  else if (route==='/upload')              { app.innerHTML=viewUpload(); setTimeout(initDropZone,0); }
  else if (route==='/my-notes')            { app.innerHTML=viewMyNotes(); }
  else if (route.startsWith('/note/'))     { app.innerHTML=viewNoteDetail(route.split('/')[2]); }
  else { app.innerHTML=navHTML()+`<main class="app-main"><div class="container"><div class="error-page"><h1>Not Found</h1><p class="error-msg">Page not found.</p><a href="#/" class="btn btn-primary">Go Home</a></div></div></main>`; }

  window.scrollTo(0,0);
}

// -- INIT ------------------------------------------------------
render();
