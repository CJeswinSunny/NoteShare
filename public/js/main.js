// ===================== TOAST AUTO-DISMISS =====================
const toast = document.getElementById('toast');
if (toast) setTimeout(() => toast.remove(), 4000);

// ===================== HAMBURGER =====================
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
  });
}

// ===================== PASSWORD TOGGLE =====================
function togglePw(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.style.color = isText ? '' : 'var(--primary)';
}
window.togglePw = togglePw;

// ===================== PASSWORD STRENGTH =====================
const pwInput = document.getElementById('password');
const pwStrength = document.getElementById('pwStrength');
if (pwInput && pwStrength) {
  pwInput.addEventListener('input', () => {
    const v = pwInput.value;
    let score = 0;
    if (v.length >= 6) score++;
    if (v.length >= 10) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const colors = ['#ef4444','#f59e0b','#f59e0b','#10b981','#10b981'];
    const widths = ['20%','40%','60%','80%','100%'];
    pwStrength.innerHTML = v ? `<div class="pw-strength-bar" style="width:${widths[score-1]||'10%'};background:${colors[score-1]||'#ef4444'}"></div>` : '';
  });
}

// ===================== CHAR COUNTER =====================
const descInput = document.getElementById('description');
const charCounter = document.getElementById('charCounter');
if (descInput && charCounter) {
  const max = parseInt(descInput.getAttribute('maxlength')) || 500;
  descInput.addEventListener('input', () => {
    charCounter.textContent = `${descInput.value.length} / ${max}`;
  });
}

// ===================== DRAG & DROP =====================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropContent = document.getElementById('dropContent');
const filePreview = document.getElementById('filePreview');
const previewName = document.getElementById('previewName');
const previewSize = document.getElementById('previewSize');
const previewIcon = document.getElementById('previewIcon');
const removeFile = document.getElementById('removeFile');
const uploadBtn = document.getElementById('uploadBtn');

const TYPE_EMOJI = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-powerpoint': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'text/plain': '📃',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/webp': '🖼️',
};

function formatBytes(b) {
  if (b > 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
}

function showPreview(file) {
  if (!filePreview) return;
  previewName.textContent = file.name;
  previewSize.textContent = formatBytes(file.size);
  previewIcon.textContent = TYPE_EMOJI[file.type] || '📁';
  dropContent.classList.add('hidden');
  filePreview.classList.remove('hidden');
  if (uploadBtn) uploadBtn.removeAttribute('disabled');
}

function clearPreview() {
  if (!fileInput) return;
  fileInput.value = '';
  if (dropContent) dropContent.classList.remove('hidden');
  if (filePreview) filePreview.classList.add('hidden');
  if (uploadBtn) uploadBtn.setAttribute('disabled', 'true');
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showPreview(fileInput.files[0]);
    else clearPreview();
  });
}
if (removeFile) removeFile.addEventListener('click', clearPreview);

if (dropZone) {
  ['dragenter','dragover'].forEach(ev => {
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  });
  ['dragleave','drop'].forEach(ev => {
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragging'); });
  });
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file && fileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      showPreview(file);
    }
  });
}

// ===================== UPLOAD PROGRESS SIMULATION =====================
const uploadForm = document.getElementById('uploadForm');
const progressWrap = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
if (uploadForm) {
  uploadForm.addEventListener('submit', e => {
    if (!fileInput || !fileInput.files[0]) return;
    if (progressWrap) progressWrap.classList.remove('hidden');
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading…'; }
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15;
      if (p > 90) p = 90;
      if (progressFill) progressFill.style.width = p + '%';
    }, 200);
    // Let form submit naturally; cleanup on unload
    window.addEventListener('beforeunload', () => clearInterval(iv));
  });
}

// ===================== SEARCH CLEAR =====================
window.clearSearch = function () {
  const si = document.getElementById('searchInput');
  if (si) { si.value = ''; si.closest('form').submit(); }
};

// ===================== FORM SUBMIT SPINNER =====================
document.querySelectorAll('.auth-form').forEach(form => {
  form.addEventListener('submit', () => {
    const btn = form.querySelector('#submitBtn');
    if (!btn) return;
    btn.disabled = true;
    const span = btn.querySelector('span');
    const spinner = btn.querySelector('.btn-spinner');
    if (span) span.textContent = 'Please wait…';
    if (spinner) spinner.classList.remove('hidden');
  });
});
