# NoteShare 📚

A full-stack Node.js platform where students can seamlessly upload, search for, and download class notes and study materials.

![NoteShare](https://img.shields.io/badge/Node.js-v22+-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **Complete Authentication** — Secure sign up / sign in with bcrypt-hashed passwords and server-side sessions
- **Browse & Search** — Filter notes by title, description, and subject with instant results
- **Drag & Drop Upload** — Drop PDF, DOC, DOCX, PPT, PPTX, TXT, and image files (up to 50 MB)
- **Download Tracking** — Every download is counted; stats shown on your personal dashboard
- **My Notes Dashboard** — View all your uploads with per-note download analytics
- **Note Detail Page** — Full metadata view with uploader info, file size, subject, and download count
- **Responsive Design** — Dark-mode UI built with vanilla CSS, looks great on all screen sizes

## 🗂️ Project Structure

```
NoteShare/
├── server.js               # Express entry point
├── src/
│   ├── database/db.js      # SQLite setup + promise helpers
│   ├── routes/
│   │   ├── auth.js         # Login, Register, Logout
│   │   └── notes.js        # Dashboard, Upload, Download, Delete
│   └── views/
│       ├── landing.ejs
│       ├── dashboard.ejs
│       ├── upload.ejs
│       ├── note-detail.ejs
│       ├── my-notes.ejs
│       ├── error.ejs
│       ├── auth/
│       │   ├── login.ejs
│       │   └── register.ejs
│       └── partials/
│           ├── head.ejs
│           ├── navbar.ejs
│           ├── footer.ejs
│           └── note-card.ejs
├── public/
│   ├── css/main.css        # Full design system
│   ├── js/main.js          # Drag-drop, toast, password strength
│   └── img/favicon.svg
├── uploads/                # Uploaded files (auto-created)
├── data/                   # SQLite database (auto-created)
├── Dockerfile
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ 
- npm

### Install & Run

```bash
npm install
npm run dev      # Development (with nodemon hot-reload)
# or
npm start        # Production
```

Open **http://localhost:3000** in your browser.

## 🐳 Docker

```bash
# Build
docker build -t noteshare:latest .

# Run
docker run -p 3000:3000 -d noteshare:latest
```

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| Templating | EJS (server-side rendering) |
| Database | SQLite via `sqlite3` |
| Auth | bcryptjs + express-session |
| File Upload | Multer (disk storage) |
| Styling | Vanilla CSS (dark design system) |

## 📋 Supported File Types

| Type | Extensions |
|---|---|
| Documents | PDF, DOC, DOCX |
| Presentations | PPT, PPTX |
| Text | TXT |
| Images | JPG, PNG, GIF, WEBP |

Maximum file size: **50 MB**

## 🌐 Routes

| Method | Route | Description |
|---|---|---|
| GET | `/` | Landing page |
| GET | `/register` | Registration form |
| POST | `/register` | Create account |
| GET | `/login` | Login form |
| POST | `/login` | Authenticate |
| POST | `/logout` | Sign out |
| GET | `/dashboard` | Browse notes (auth required) |
| GET | `/upload` | Upload form (auth required) |
| POST | `/upload` | Submit note (auth required) |
| GET | `/note/:id` | Note detail (auth required) |
| GET | `/download/:id` | Download file (auth required) |
| POST | `/note/:id/delete` | Delete own note (auth required) |
| GET | `/my-notes` | My notes & stats (auth required) |
