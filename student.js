// Student Dashboard — Router & Pages
import { guardRoute, logout } from './auth.js';
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, orderBy, addDoc, doc, getDoc,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const { toast, btnLoading } = window.MPLSUI;

// Anti-cheat scoring rules 
export const PENALTY_RULES = {
  tab_hidden: { points: 10, label: 'Pindah tab / minimize' },
  blur:       { points: 8,  label: 'Kehilangan fokus jendela' },
  copy:       { points: 8,  label: 'Copy / cut konten' },
  paste:      { points: 5,  label: 'Paste konten' },
};
const MAX_VIOLATIONS_BEFORE_AUTOSUBMIT = 10;

// Tulis log audit pelanggaran ke Firestore (collection: auditLogs)
async function writeAuditLog({ profile, type, message, quizSet, penalty, meta = {} }) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId: profile.uid,
      name: profile.name || null,
      gugus: profile.gugus || null,
      kelas: profile.kelas || null,
      type, message, quizSet: quizSet || null,
      penalty: penalty || 0,
      userAgent: navigator.userAgent,
      url: location.pathname,
      meta,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.warn('audit log fail', e); }
}

let profile;
let pageUnsubscribe = null;
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');

(async () => {
  profile = await guardRoute('student');
  document.getElementById('uName').textContent = profile.name || 'Siswa';
  document.getElementById('uGugus').textContent = `${profile.gugus || '-'} · ${profile.kelas || ''}`;
  document.getElementById('avInit').textContent = (profile.name || 'S').charAt(0).toUpperCase();
  setupNav();
  loadPage('overview');
})();

document.getElementById('btnLogout').onclick = async () => { await logout(); location.href = 'login.html'; };

function setupNav() {
  document.querySelectorAll('.sb-link').forEach(a => {
    a.addEventListener('click', (e) => {
      document.querySelectorAll('.sb-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      loadPage(a.dataset.page);
      document.getElementById('sb').classList.remove('open');
    });
  });
}

const titles = { overview:'Beranda', soal:'Soal MPLS', materi:'Materi', jadwal:'Jadwal Kegiatan', rating:'Rating OSIS', nilai:'Nilai Saya', notif:'Notifikasi', info:'Informasi MPLS', profil:'Profil' };

function renderError(err, retryFn) {
  const msg = (err && err.message) ? err.message : String(err || 'Terjadi kesalahan');
  console.error('[student]', err);
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3 style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat halaman</h3></div>
      <p style="color:var(--muted);margin-bottom:14px">${msg}</p>
      <button class="btn btn-primary" id="btnRetryS"><i class="fa-solid fa-rotate"></i> Coba Lagi</button>
    </div>`;
  const b = document.getElementById('btnRetryS');
  if (b) b.onclick = () => retryFn && retryFn();
}

function safePage(name, fn) {
  return async () => {
    try { await fn(); }
    catch (e) { renderError(e, () => loadPage(name)); }
  };
}

function loadPage(page) {
  if (pageUnsubscribe) { pageUnsubscribe(); pageUnsubscribe = null; }
  pageTitle.textContent = titles[page] || page;
  content.innerHTML = '<div class="empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  // sync bottom nav
  if (window.mbnSetActive) window.mbnSetActive(page);
  // sync sidebar links
  document.querySelectorAll('.sb-link').forEach(x => x.classList.remove('active'));
  const active = document.querySelector(`.sb-link[data-page="${page}"]`);
  if (active) active.classList.add('active');
  const map = {
    overview: safePage('overview', pageOverview),
    soal:     safePage('soal',     pageSoal),
    materi:   safePage('materi',   pageMateri),
    jadwal:   safePage('jadwal',   pageJadwal),
    rating:   safePage('rating',   pageRating),
    nilai:    safePage('nilai',    pageNilai),
    notif:    safePage('notif',    pageNotif),
    info:     safePage('info',     pageInfo),
    profil:   safePage('profil',   pageProfil),
  };
  (map[page] || map.overview)();
}

// ===== Overview =====
async function pageOverview() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const firstName = (profile.name || 'Siswa').split(' ')[0];

  content.innerHTML = `
    <div class="db-welcome db-welcome-student">
      <div class="db-welcome-text">
        <span class="db-welcome-label">${greeting} 👋</span>
        <h2 class="db-welcome-name">${firstName}</h2>
        <span class="db-welcome-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
      </div>
      <div class="db-welcome-icon db-welcome-icon-student"><i class="fa-solid fa-graduation-cap"></i></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi kpi-red">
        <div class="kpi-icon"><i class="fa-solid fa-file-pen"></i></div>
        <div class="kpi-body">
          <strong id="kQ">—</strong>
          <span class="kpi-label">Paket Soal</span>
          <small>Tersedia untukmu</small>
        </div>
      </div>
      <div class="kpi kpi-gold">
        <div class="kpi-icon"><i class="fa-solid fa-book-open"></i></div>
        <div class="kpi-body">
          <strong id="kM">—</strong>
          <span class="kpi-label">Materi</span>
          <small>Topik MPLS</small>
        </div>
      </div>
      <div class="kpi kpi-green">
        <div class="kpi-icon"><i class="fa-solid fa-flag-checkered"></i></div>
        <div class="kpi-body">
          <strong id="kK">—</strong>
          <span class="kpi-label">Kegiatan</span>
          <small>Akan datang</small>
        </div>
      </div>
      <div class="kpi kpi-brown">
        <div class="kpi-icon"><i class="fa-solid fa-people-group"></i></div>
        <div class="kpi-body">
          <strong>${profile.gugus || '—'}</strong>
          <span class="kpi-label">Gugus</span>
          <small>${profile.kelas || 'Kelas'}</small>
        </div>
      </div>
    </div>

    <div class="panel db-student-cta">
      <div class="panel-head"><h3><i class="fa-solid fa-rocket" style="color:var(--secondary);margin-right:6px"></i>Mulai Sekarang</h3></div>
      <p style="color:var(--muted);margin-bottom:14px">Lanjutkan perjalanan MPLS-mu! Kerjakan soal dan ikuti jadwal kegiatan tepat waktu.</p>
      <div class="db-cta-btns">
        <button class="btn btn-primary db-cta-main" onclick="document.querySelector('[data-page=soal]').click()">
          <i class="fa-solid fa-file-pen"></i> Kerjakan Soal
        </button>
        <button class="btn btn-outline" onclick="document.querySelector('[data-page=jadwal]').click()">
          <i class="fa-solid fa-calendar"></i> Lihat Jadwal
        </button>
        <button class="btn btn-outline" onclick="document.querySelector('[data-page=materi]').click()">
          <i class="fa-solid fa-book-open"></i> Baca Materi
        </button>
      </div>
    </div>`;

  try {
    const q = await getDocs(collection(db, 'questions'));
    const m = await getDocs(collection(db, 'materials'));
    const k = await getDocs(collection(db, 'schedule'));
    // count unique quiz sets, not individual questions
    const sets = new Set(); q.forEach(d => sets.add(d.data().quizSet || 'Umum'));
    document.getElementById('kQ').textContent = sets.size;
    document.getElementById('kM').textContent = m.size;
    document.getElementById('kK').textContent = k.size;
  } catch {}
}

// ===== Soal List =====
async function pageSoal() {
  try {
    const snap = await getDocs(collection(db, 'questions'));
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    if (!items.length) { content.innerHTML = emptyState('Belum ada soal', 'Admin belum menambahkan soal.'); return; }
    // group by quizSet (each doc = single question; quizSet groups them)
    const sets = {};
    items.forEach(q => { const k = q.quizSet || 'Umum'; (sets[k] = sets[k] || []).push(q); });
    const subs = await getDocs(query(collection(db, 'answers'), where('userId','==',profile.uid)));
    const done = new Set(); subs.forEach(s => done.add(s.data().quizSet));
    let html = '<div class="grid-3">';
    Object.entries(sets).forEach(([name, list]) => {
      const isDone = done.has(name);
      html += `
        <div class="card">
          <div class="card-icon"><i class="fa-solid fa-file-pen"></i></div>
          <h3>${name}</h3>
          <p>${list.length} soal</p>
          ${isDone
            ? '<span class="badge green" style="margin-top:10px"><i class="fa-solid fa-check"></i> Sudah dikerjakan</span>'
            : `<button class="btn btn-primary" style="margin-top:14px" onclick="window.startQuiz('${name}')"><i class="fa-solid fa-play"></i> Mulai Mengerjakan</button>`}
        </div>`;
    });
    content.innerHTML = html + '</div>';
  } catch (e) { content.innerHTML = emptyState('Error', e.message); }
}

window.startQuiz = (setName) => renderQuiz(setName);
window.loadPage = loadPage;

// ===== Quiz with Anti-Cheat (International Exam UI) =====
async function renderQuiz(setName) {
  const snap = await getDocs(query(collection(db, 'questions'), where('quizSet','==',setName)));
  const qs = []; snap.forEach(d => qs.push({ id: d.id, ...d.data() }));
  qs.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  if (!qs.length) return toast('Soal kosong', { type: 'warning' });

  pageTitle.textContent = `Ujian · ${setName}`;
  const answers = {};
  const flagged = new Set();
  let violationCount = 0;
  let penaltyTotal = 0;
  const violationLog = [];
  let current = 0;
  let started = true;

  const OPT_KEYS = ['A','B','C','D','E','F','G','H'];

  const shell = () => {
    content.innerHTML = `
      <div class="exam-shell">
        <div class="exam-main">
          <div class="exam-top">
            <div>
              <div class="ex-title">${setName}</div>
              <div class="ex-sub">${qs.length} soal · Anti-cheat aktif (${MAX_VIOLATIONS_BEFORE_AUTOSUBMIT}x pelanggaran = auto-submit)</div>
            </div>
            <span class="exam-pill" id="vPill"><i class="fa-solid fa-shield-halved"></i> Pelanggaran 0/${MAX_VIOLATIONS_BEFORE_AUTOSUBMIT}</span>
          </div>
          <div class="exam-body" id="qBody"></div>
          <div class="exam-nav">
            <button class="btn btn-outline" id="btnPrev"><i class="fa-solid fa-chevron-left"></i> Sebelumnya</button>
            <button class="exam-flag" id="btnFlag"><i class="fa-regular fa-flag"></i> Tandai</button>
            <div class="spacer"></div>
            <button class="btn btn-primary" id="btnNext">Berikutnya <i class="fa-solid fa-chevron-right"></i></button>
            <button class="btn btn-gold" id="btnSubmit" style="display:none"><i class="fa-solid fa-paper-plane"></i> Kumpulkan</button>
          </div>
        </div>
        <aside class="exam-side">
          <h4><i class="fa-solid fa-list-ol"></i> Navigasi Soal</h4>
          <div class="exam-grid" id="palette"></div>
          <div class="exam-legend">
            <span><i class="lg-cur"></i> Soal aktif</span>
            <span><i class="lg-ans"></i> Sudah dijawab</span>
            <span><i class="lg-flag"></i> Ditandai</span>
          </div>
          <div class="exam-summary">
            Terjawab: <strong id="sAns">0</strong> / ${qs.length}<br>
            Ditandai: <strong id="sFlag">0</strong><br>
            Penalti: <strong id="sPen" style="color:#dc2626">−0</strong>
          </div>
          <button class="btn btn-primary btn-block" id="btnSubmitSide" style="margin-top:14px"><i class="fa-solid fa-paper-plane"></i> Kumpulkan Sekarang</button>
        </aside>
      </div>`;
    document.getElementById('btnPrev').onclick = () => go(current - 1);
    document.getElementById('btnNext').onclick = () => go(current + 1);
    document.getElementById('btnFlag').onclick = toggleFlag;
    document.getElementById('btnSubmit').onclick = confirmSubmit;
    document.getElementById('btnSubmitSide').onclick = confirmSubmit;
    renderPalette();
    renderQ();
  };

  const renderPalette = () => {
    const p = document.getElementById('palette');
    p.innerHTML = qs.map((_,i) => {
      const cls = ['exam-cell'];
      if (i === current) cls.push('current');
      else if (answers[qs[i].id] !== undefined && answers[qs[i].id] !== '') cls.push('answered');
      if (flagged.has(i)) cls.push('flagged');
      return `<button class="${cls.join(' ')}" data-i="${i}">${i+1}</button>`;
    }).join('');
    p.querySelectorAll('button').forEach(b => b.onclick = () => go(+b.dataset.i));
    document.getElementById('sAns').textContent = Object.keys(answers).filter(k => answers[k] !== '' && answers[k] !== undefined).length;
    document.getElementById('sFlag').textContent = flagged.size;
    document.getElementById('sPen').textContent = '−' + penaltyTotal;
  };

  const renderQ = () => {
    const q = qs[current];
    const body = document.getElementById('qBody');
    let inner = `
      <div class="exam-qnum">SOAL ${current+1} DARI ${qs.length} · ${q.type === 'mcq' ? 'Pilihan Ganda' : 'Isian Singkat'}</div>
      <div class="exam-qtext">${escapeHtml(q.text)}</div>`;
    if (q.type === 'mcq') {
      inner += '<div class="exam-options">' + (q.options || []).map((opt, oi) => {
        const checked = answers[q.id] === oi ? ' checked' : '';
        return `<label class="exam-opt${checked ? ' checked':''}">
          <span class="opt-key">${OPT_KEYS[oi] || (oi+1)}</span>
          <input type="radio" name="opt" value="${oi}"${answers[q.id]===oi?' checked':''}>
          <span>${escapeHtml(opt)}</span>
        </label>`;
      }).join('') + '</div>';
    } else {
      inner += `<input class="exam-text-input" type="text" id="txtAns" placeholder="Ketik jawabanmu di sini..." value="${escapeAttr(answers[q.id] || '')}">`;
    }
    body.innerHTML = inner;

    if (q.type === 'mcq') {
      body.querySelectorAll('.exam-opt').forEach(label => {
        label.addEventListener('click', () => {
          body.querySelectorAll('.exam-opt').forEach(o => o.classList.remove('checked'));
          label.classList.add('checked');
          const inp = label.querySelector('input');
          inp.checked = true;
          answers[q.id] = +inp.value;
          renderPalette();
        });
      });
    } else {
      const t = document.getElementById('txtAns');
      t.oninput = (e) => { answers[q.id] = e.target.value; renderPalette(); };
    }

    // Nav buttons state
    document.getElementById('btnPrev').disabled = current === 0;
    const isLast = current === qs.length - 1;
    document.getElementById('btnNext').style.display = isLast ? 'none' : '';
    document.getElementById('btnSubmit').style.display = isLast ? '' : 'none';
    const flagBtn = document.getElementById('btnFlag');
    flagBtn.classList.toggle('on', flagged.has(current));
    flagBtn.innerHTML = flagged.has(current)
      ? '<i class="fa-solid fa-flag"></i> Ditandai'
      : '<i class="fa-regular fa-flag"></i> Tandai';
  };

  const go = (i) => {
    if (i < 0 || i >= qs.length) return;
    current = i; renderQ(); renderPalette();
  };
  const toggleFlag = () => {
    if (flagged.has(current)) flagged.delete(current); else flagged.add(current);
    renderQ(); renderPalette();
  };

  const confirmSubmit = () => {
    const answered = Object.keys(answers).filter(k => answers[k] !== '' && answers[k] !== undefined).length;
    const unanswered = qs.length - answered;
    const msg = unanswered > 0
      ? `Masih ada ${unanswered} soal belum dijawab. Yakin kumpulkan sekarang?`
      : 'Kumpulkan jawaban sekarang?';
    if (confirm(msg)) submit(false, 'Submit normal');
  };

  const submit = async (auto, reason='Submit normal') => {
    if (!started) return; started = false;
    cleanup();
    try {
      await addDoc(collection(db, 'answers'), {
        userId: profile.uid, name: profile.name || null, gugus: profile.gugus || null, kelas: profile.kelas || null,
        quizSet: setName, answers,
        violations: violationCount, violationLog,
        reason, status: 'submitted', autoSubmitted: !!auto,
        finalScore: null, gradedAt: null,
        createdAt: serverTimestamp()
      });
      content.innerHTML = `
        <div class="result-card panel">
          <div class="card-icon" style="margin:0 auto 16px"><i class="fa-solid fa-circle-check"></i></div>
          <h3 style="font-family:var(--font-display);font-size:24px;margin-bottom:6px">Jawaban Terkirim</h3>
          <p style="color:var(--muted);margin-bottom:20px">${reason}</p>
          <p style="color:var(--muted);margin-bottom:16px;text-align:center">Jawabanmu akan dikoreksi oleh admin.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <button class="btn btn-outline" onclick="document.querySelector('[data-page=soal]').click()">Kembali ke Soal</button>
            <button class="btn btn-primary" onclick="document.querySelector('[data-page=nilai]').click()">Lihat Nilai</button>
          </div>
        </div>`;
      toast('Jawaban terkirim.', { type: 'success' });
    } catch (e) { toast('Gagal kirim: ' + e.message, { type: 'error' }); }
  };

  const refreshPenaltyUI = () => {
    const p = document.getElementById('vPill');
    if (p) {
      p.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Pelanggaran ${violationCount}/${MAX_VIOLATIONS_BEFORE_AUTOSUBMIT}`;
      p.classList.toggle('warn', violationCount > 0);
    }
    const s = document.getElementById('sPen'); if (s) s.textContent = '−' + penaltyTotal;
  };

  const violate = (type) => {
    if (!started) return;
    const rule = PENALTY_RULES[type] || { points: 5, label: type };
    violationCount++;
    penaltyTotal += rule.points;
    violationLog.push({ type, message: rule.label, penalty: rule.points, at: Date.now() });
    refreshPenaltyUI();
    writeAuditLog({ profile, type, message: rule.label, quizSet: setName, penalty: rule.points, meta: { violationCount, penaltyTotal } });
    toast(`Pelanggaran: ${rule.label} (−${rule.points} poin)`, { type: 'warning', duration: 3500 });
    if (violationCount >= MAX_VIOLATIONS_BEFORE_AUTOSUBMIT) {
      const banner = document.createElement('div');
      banner.className = 'warn-banner';
      banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Batas pelanggaran tercapai. Sesi otomatis dikumpulkan.`;
      document.body.appendChild(banner);
      submit(true, 'Auto-submit: melebihi batas pelanggaran');
      setTimeout(() => banner.remove(), 4500);
    }
  };

  // Anti-cheat handlers (versi ringan, ramah HP)
  const onVis = () => { if (document.hidden) violate('tab_hidden'); };
  const onBlur = () => violate('blur');
  const onCopy = (e) => { e.preventDefault(); violate('copy'); };
  const onPaste = (e) => { e.preventDefault(); violate('paste'); };
  const onKey = (e) => {
    // hanya panah kiri/kanan untuk navigasi soal — tidak menghitung pelanggaran
    if (e.key === 'ArrowRight' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) go(current+1);
    if (e.key === 'ArrowLeft'  && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) go(current-1);
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCopy);
  document.addEventListener('paste', onPaste);
  document.addEventListener('keydown', onKey);

  // === Mode mengerjakan soal: aktifkan fullscreen + sembunyikan tombol notifikasi ===
  document.body.classList.add('exam-mode');
  const requestFs = () => {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (fn && !document.fullscreenElement && !document.webkitFullscreenElement) {
      try { fn.call(el).catch(()=>{}); } catch(_) {}
    }
  };
  // Beberapa browser butuh user gesture — coba sekarang, lalu sekali lagi saat klik pertama
  requestFs();
  const fsRetry = () => { requestFs(); document.removeEventListener('click', fsRetry); };
  document.addEventListener('click', fsRetry, { once: true });

  function cleanup() {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('cut', onCopy);
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', fsRetry);
    document.body.classList.remove('exam-mode');
    const exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exitFn && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try { exitFn.call(document).catch(()=>{}); } catch(_) {}
    }
  }
  shell();
}

function escapeHtml(s) { return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// ===== Materi =====
async function pageMateri() {
  const snap = await getDocs(collection(db, 'materials'));
  const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  if (!items.length) return content.innerHTML = emptyState('Belum ada materi', 'Materi akan ditambahkan oleh admin.');
  content.innerHTML = '<div class="grid-3">' + items.map(m => `
    <div class="card">
      <div class="card-icon gold"><i class="fa-solid fa-book-open"></i></div>
      <h3>${m.title}</h3>
      <p>${m.description || ''}</p>
      ${m.url ? `<a href="${m.url}" target="_blank" class="btn btn-outline" style="margin-top:14px"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka</a>` : ''}
    </div>`).join('') + '</div>';
}

// ===== Jadwal =====
const DAY_ORDER = { Senin:0, Selasa:1, Rabu:2, Kamis:3, Jumat:4 };
const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function daySortKey(dayStr) {
  const name = (dayStr||'').split(',')[0].trim();
  return DAY_ORDER[name] !== undefined ? DAY_ORDER[name] : 99;
}

function renderJadwal(items) {
  if (!items.length) return content.innerHTML = emptyState('Belum ada jadwal kegiatan', 'Akan diperbarui oleh admin.');
  const groups = {};
  items.forEach(s => {
    const k = s.day || 'Lainnya';
    (groups[k] = groups[k] || []).push(s);
  });
  const sortedDays = Object.keys(groups).sort((a,b) => daySortKey(a) - daySortKey(b) || a.localeCompare(b));
  let html = '';
  sortedDays.forEach(day => {
    const list = groups[day].sort((a,b) => (a.time||'').localeCompare(b.time||''));
    html += `
      <div class="panel" style="margin-top:8px">
        <div class="panel-head" style="border-bottom:2px solid var(--secondary)"><h4 style="margin:0;font-family:var(--font-display);color:var(--secondary)"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(day)}</h4></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th style="width:40px">No</th><th>Waktu</th><th>Kegiatan</th><th>Lokasi</th></tr></thead>
          <tbody>${list.map((s,i) => `<tr><td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td><td>${escapeHtml(s.time||'')}</td><td>${escapeHtml(s.title||'')}</td><td>${escapeHtml(s.location||'-')}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  });
  content.innerHTML = html;
}

function pageJadwal() {
  pageUnsubscribe = onSnapshot(collection(db, 'schedule'), (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    renderJadwal(items);
  }, (err) => {
    console.error('jadwal snapshot error', err);
    content.innerHTML = emptyState('Gagal memuat jadwal', err.message);
  });
}

// ===== Rating OSIS =====
async function pageRating() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const today6 = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 6 - 7, 0, 0, 0));
  if (wib.getUTCHours() < 6) today6.setDate(today6.getDate() - 1);
  const snap = await getDocs(query(collection(db, 'ratings'), where('userId','==',profile.uid)));
  const existing = []; snap.forEach(d => existing.push(d.data().createdAt));
  const found = existing.some(c => c && c.toDate().getTime() >= today6.getTime());
  if (found) {
    content.innerHTML = `
      <div class="panel" style="max-width:560px;margin:0 auto;text-align:center">
        <div class="card-icon gold" style="margin:0 auto 12px"><i class="fa-solid fa-star"></i></div>
        <h3 style="font-family:var(--font-display);font-size:22px">Terima kasih!</h3>
        <p style="color:var(--muted)">Kamu sudah memberi rating hari ini.<br>Kembali lagi besok setelah jam 6 pagi.</p>
      </div>`;
    return;
  }
  content.innerHTML = `
    <div class="panel" style="max-width:560px;margin:0 auto;text-align:center">
      <div class="card-icon gold" style="margin:0 auto 12px"><i class="fa-solid fa-star"></i></div>
      <h3 style="font-family:var(--font-display);font-size:22px">Beri Rating untuk OSIS</h3>
      <p style="color:var(--muted)">Penilaianmu membantu OSIS berkembang lebih baik.</p>
      <div class="stars" id="stars">${[1,2,3,4,5].map(i => `<i class="fa-solid fa-star" data-v="${i}"></i>`).join('')}</div>
      <textarea id="cmt" placeholder="Komentar singkat (opsional)..." style="width:100%;padding:12px;border:1px solid var(--line);border-radius:11px;min-height:90px;margin-bottom:14px"></textarea>
      <button class="btn btn-primary btn-block" id="bRate"><i class="fa-solid fa-paper-plane"></i> Kirim Rating</button>
    </div>`;
  let val = 0;
  document.querySelectorAll('#stars i').forEach(s => s.addEventListener('click', () => {
    val = +s.dataset.v;
    document.querySelectorAll('#stars i').forEach((x,i) => x.classList.toggle('on', i < val));
  }));
  document.getElementById('bRate').onclick = async () => {
    if (!val) return toast('Pilih rating dulu', { type: 'warning' });
    const btn = document.getElementById('bRate');
    btnLoading(btn, true, 'Mengirim...');
    try {
      await addDoc(collection(db, 'ratings'), {
        userId: profile.uid, name: profile.name || null,         gugus: profile.gugus || null,
        rating: val, comment: document.getElementById('cmt').value.trim(),
        createdAt: serverTimestamp()
      });
      toast('Terima kasih atas rating-mu!', { type: 'success' });
      pageRating();
    } catch (e) { btnLoading(btn, false); toast(e.message, { type: 'error' }); }
  };
}

// ===== Nilai =====
async function pageNilai() {
  const snap = await getDocs(query(collection(db, 'answers'), where('userId','==',profile.uid)));
  const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  if (!items.length) return content.innerHTML = emptyState('Belum ada nilai', 'Kerjakan soal dulu untuk melihat hasil.');
  content.innerHTML = `<div class="panel"><div class="panel-head"><h3>Hasil Nilai Saya</h3></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Set Soal</th><th>Nilai Akhir</th><th>Status</th></tr></thead>
      <tbody>${items.map(a => `<tr>
        <td><strong>${a.quizSet}</strong></td>
        <td>${a.finalScore != null ? `<strong style="color:var(--blue)">${a.finalScore}</strong>` : '-'}</td>
        <td>${a.finalScore != null ? '<span class="badge green">Sudah dinilai</span>' : '<span class="badge gold">Menunggu koreksi admin</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
}

// ===== Notifikasi =====
async function pageNotif() {
  const snap = await getDocs(collection(db, 'notifications'));
  const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  if (!items.length) return content.innerHTML = emptyState('Tidak ada notifikasi', 'Pengumuman akan tampil di sini.');
  content.innerHTML = items.map(n => `
    <div class="panel"><div style="display:flex;gap:14px"><div class="hc-icon blue"><i class="fa-solid fa-bell"></i></div>
      <div><strong>${n.title}</strong><p style="color:var(--muted);margin-top:4px">${n.body || ''}</p></div></div></div>`).join('');
}

// ===== Info MPLS =====
function pageInfo() {
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Informasi MPLS 2025</h3></div>
      <p style="color:var(--muted);margin-bottom:14px">Masa Pengenalan Lingkungan Sekolah (MPLS) adalah kegiatan untuk mengenalkan siswa baru dengan lingkungan sekolah, budaya, kurikulum, dan kakak kelas mereka.</p>
      <div class="grid-3">
        <div class="feature"><i class="fa-solid fa-calendar"></i><h4>Durasi</h4><p>5 hari aktif</p></div>
        <div class="feature"><i class="fa-solid fa-people-group"></i><h4>Sistem Gugus</h4><p>7 gugus, kompetisi sehat</p></div>
        <div class="feature"><i class="fa-solid fa-shirt"></i><h4>Seragam</h4><p>Seragam SMP + atribut MPLS</p></div>
      </div>
    </div>`;
}

// ===== Profil =====
function pageProfil() {
  content.innerHTML = `
    <div class="panel" style="max-width:560px">
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px">
        <div class="dev-avatar" style="width:72px;height:72px;font-size:24px">${(profile.name||'S').charAt(0)}</div>
        <div><h3 style="font-family:var(--font-display);font-size:22px">${profile.name}</h3><p style="color:var(--muted)">${profile.email}</p></div>
      </div>
      <table class="tbl"><tbody>
        <tr><td>NIS</td><td><strong>${profile.nis || '-'}</strong></td></tr>
        <tr><td>Kelas</td><td><strong>${profile.kelas || '-'}</strong></td></tr>
        <tr><td>Gugus</td><td><span class="badge blue">${profile.gugus || '-'}</span></td></tr>
        <tr><td>Role</td><td><span class="badge gray">Siswa</span></td></tr>
      </tbody></table>
    </div>`;
}

function emptyState(title, sub) {
  return `<div class="panel"><div class="empty"><i class="fa-solid fa-inbox"></i><h3>${title}</h3><p>${sub}</p></div></div>`;
}
