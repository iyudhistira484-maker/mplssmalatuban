// ============================================================
// Student Dashboard — Router & Pages
// ============================================================
import { guardRoute, logout } from './auth.js';
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, orderBy, addDoc, doc, getDoc,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const { toast, btnLoading } = window.MPLSUI;

// ============================================================
// Anti-cheat scoring rules (penalti per pelanggaran)
// ============================================================
export const PENALTY_RULES = {
  tab_hidden:     { points: 15, label: 'Pindah tab / minimize' },
  blur:           { points: 10, label: 'Kehilangan fokus jendela' },
  copy:           { points: 10, label: 'Copy / cut konten' },
  paste:          { points: 5,  label: 'Paste konten' },
  contextmenu:    { points: 3,  label: 'Klik kanan' },
  shortcut:       { points: 8,  label: 'Shortcut keyboard terlarang' },
  devtools:       { points: 25, label: 'Membuka DevTools (F12)' },
  unload:         { points: 20, label: 'Refresh / tutup tab' },
  fullscreen_exit:{ points: 12, label: 'Keluar dari mode penuh' },
};
const MAX_VIOLATIONS_BEFORE_AUTOSUBMIT = 3;

// Tulis log audit pelanggaran ke Firestore (collection: auditLogs)
async function writeAuditLog({ profile, type, message, quizSet, penalty, meta = {} }) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId: profile.uid,
      name: profile.name,
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

const titles = { overview:'Beranda', soal:'Soal MPLS', materi:'Materi', jadwal:'Jadwal Pelajaran', kegiatan:'Jadwal Kegiatan', rating:'Rating OSIS', nilai:'Nilai Saya', notif:'Notifikasi', info:'Informasi MPLS', profil:'Profil' };

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
  pageTitle.textContent = titles[page] || page;
  content.innerHTML = '<div class="empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  const map = {
    overview: safePage('overview', pageOverview),
    soal:     safePage('soal',     pageSoal),
    materi:   safePage('materi',   pageMateri),
    jadwal:   safePage('jadwal',   pageJadwal),
    kegiatan: safePage('kegiatan', pageKegiatan),
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
  content.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top">Soal Tersedia <i class="fa-solid fa-file-pen"></i></div><strong id="kQ">0</strong><small>Aktif minggu ini</small></div>
      <div class="kpi"><div class="kpi-top">Materi <i class="fa-solid fa-book"></i></div><strong id="kM">0</strong><small>Topik MPLS</small></div>
      <div class="kpi"><div class="kpi-top">Kegiatan <i class="fa-solid fa-flag"></i></div><strong id="kK">0</strong><small>Akan datang</small></div>
      <div class="kpi"><div class="kpi-top">Gugus <i class="fa-solid fa-people-group"></i></div><strong>${profile.gugus || '-'}</strong><small>${profile.kelas || ''}</small></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Selamat datang, ${profile.name}!</h3></div>
      <p style="color:var(--muted)">Lanjutkan perjalanan MPLS-mu. Pastikan kamu mengerjakan soal dan mengikuti jadwal kegiatan tepat waktu.</p>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="document.querySelector('[data-page=soal]').click()"><i class="fa-solid fa-file-pen"></i> Kerjakan Soal</button>
        <button class="btn btn-outline" onclick="document.querySelector('[data-page=jadwal]').click()"><i class="fa-solid fa-calendar"></i> Lihat Jadwal</button>
      </div>
    </div>`;
  try {
    const q = await getDocs(collection(db, 'questions'));
    const m = await getDocs(collection(db, 'materials'));
    const k = await getDocs(collection(db, 'activities'));
    document.getElementById('kQ').textContent = q.size;
    document.getElementById('kM').textContent = m.size;
    document.getElementById('kK').textContent = k.size;
  } catch {}
}

// ===== Soal List =====
async function pageSoal() {
  try {
    const snap = await getDocs(collection(db, 'questions'));
    const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
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
          <p>${list.length} soal · Estimasi ${list.length * 2} menit</p>
          ${isDone
            ? '<span class="badge green" style="margin-top:10px"><i class="fa-solid fa-check"></i> Sudah dikerjakan</span>'
            : `<button class="btn btn-primary" style="margin-top:14px" onclick="window.startQuiz('${name}')"><i class="fa-solid fa-play"></i> Mulai Mengerjakan</button>`}
        </div>`;
    });
    content.innerHTML = html + '</div>';
  } catch (e) { content.innerHTML = emptyState('Error', e.message); }
}

window.startQuiz = (setName) => renderQuiz(setName);

// ===== Quiz with Anti-Cheat =====
async function renderQuiz(setName) {
  const snap = await getDocs(query(collection(db, 'questions'), where('quizSet','==',setName)));
  const qs = []; snap.forEach(d => qs.push({ id: d.id, ...d.data() }));
  if (!qs.length) return toast('Soal kosong', { type: 'warning' });

  pageTitle.textContent = `Soal · ${setName}`;
  let answers = {};
  let violationCount = 0;
  let penaltyTotal = 0;
  const violationLog = []; // { type, message, penalty, at }
  let timeLeft = qs.length * 120;
  let timerEl, progEl, penEl, started = true;

  const render = () => {
    content.innerHTML = `
      <div class="quiz-shell">
        <div class="quiz-head">
          <div><strong>${setName}</strong><div style="color:var(--muted);font-size:13px">${qs.length} soal · Anti-cheat aktif (${MAX_VIOLATIONS_BEFORE_AUTOSUBMIT}x pelanggaran = auto-submit)</div></div>
          <div class="quiz-timer" id="timer">--:--</div>
        </div>
        <div class="quiz-progress"><span id="prog" style="width:0%"></span></div>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <span class="badge gray" id="vCount"><i class="fa-solid fa-shield-halved"></i> Pelanggaran: 0</span>
          <span class="badge red" id="penTag" style="display:none"><i class="fa-solid fa-minus"></i> Penalti: 0</span>
        </div>
        <div id="qList" style="margin-top:18px"></div>
        <button class="btn btn-primary btn-lg btn-block" id="btnSubmit" style="margin-top:20px"><i class="fa-solid fa-paper-plane"></i> Kumpulkan Jawaban</button>
        <p style="margin-top:14px;font-size:13px;color:var(--red);text-align:center"><i class="fa-solid fa-shield-halved"></i> Setiap pelanggaran (pindah tab, copy, klik kanan, dsb) akan mengurangi nilai akhir & dicatat ke audit log admin.</p>
      </div>`;
    const list = document.getElementById('qList');
    qs.forEach((q, i) => {
      const div = document.createElement('div'); div.className = 'qcard';
      div.innerHTML = `<h4>${i+1}. ${q.text}</h4>` +
        (q.type === 'mcq' ? (q.options || []).map((opt, oi) =>
          `<label class="qopt"><input type="radio" name="q${q.id}" value="${oi}"> ${opt}</label>`).join('')
        : `<input type="text" placeholder="Jawaban singkat..." style="width:100%;padding:12px;border:1px solid var(--line);border-radius:11px" data-q="${q.id}">`);
      list.appendChild(div);
    });
    list.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', e => {
      const id = e.target.name.slice(1); answers[id] = +e.target.value;
      e.target.closest('.qcard').querySelectorAll('.qopt').forEach(o => o.classList.remove('checked'));
      e.target.closest('.qopt').classList.add('checked');
      updateProg();
    }));
    list.querySelectorAll('input[type=text]').forEach(t => t.addEventListener('input', e => {
      answers[e.target.dataset.q] = e.target.value; updateProg();
    }));
    timerEl = document.getElementById('timer'); progEl = document.getElementById('prog');
    penEl = document.getElementById('penTag');
    document.getElementById('btnSubmit').onclick = () => submit(false, 'Submit normal');
    tick();
  };
  const updateProg = () => { progEl.style.width = (Object.keys(answers).length / qs.length * 100) + '%'; };
  const refreshPenaltyUI = () => {
    const c = document.getElementById('vCount');
    if (c) c.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Pelanggaran: ${violationCount}/${MAX_VIOLATIONS_BEFORE_AUTOSUBMIT}`;
    if (penEl && penaltyTotal > 0) {
      penEl.style.display = '';
      penEl.innerHTML = `<i class="fa-solid fa-minus"></i> Penalti: -${penaltyTotal}`;
    }
  };
  const tick = () => {
    if (!started) return;
    const m = String(Math.floor(timeLeft/60)).padStart(2,'0'), s = String(timeLeft%60).padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if (timeLeft-- <= 0) { submit(true, 'Waktu habis'); return; }
    setTimeout(tick, 1000);
  };
  const submit = async (auto, reason='Submit normal') => {
    if (!started) return; started = false;
    cleanup();
    let autoScore = 0, maxScore = 0;
    qs.forEach(q => {
      if (q.type === 'mcq') { maxScore += 10; if (answers[q.id] === q.correctIndex) autoScore += 10; }
    });
    // Skor auto setelah penalti (tidak boleh < 0)
    const scoreAfterPenalty = Math.max(0, autoScore - penaltyTotal);
    try {
      await addDoc(collection(db, 'answers'), {
        userId: profile.uid, name: profile.name, gugus: profile.gugus, kelas: profile.kelas,
        quizSet: setName, answers,
        autoScore, maxAutoScore: maxScore,
        penaltyTotal, scoreAfterPenalty,
        violations: violationCount, violationLog,
        reason, status: 'submitted', autoSubmitted: !!auto,
        finalScore: null, gradedAt: null,
        createdAt: serverTimestamp()
      });
      toast(`Jawaban terkirim. Skor ${autoScore}/${maxScore} − Penalti ${penaltyTotal} = ${scoreAfterPenalty}`, { type: 'success', duration: 6000 });
      pageSoal();
    } catch (e) { toast('Gagal kirim: ' + e.message, { type: 'error' }); }
  };
  const violate = (type) => {
    if (!started) return;
    const rule = PENALTY_RULES[type] || { points: 5, label: type };
    violationCount++;
    penaltyTotal += rule.points;
    violationLog.push({ type, message: rule.label, penalty: rule.points, at: Date.now() });
    refreshPenaltyUI();
    // Audit log async
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
  // Anti-cheat handlers
  const onVis = () => { if (document.hidden) violate('tab_hidden'); };
  const onBlur = () => violate('blur');
  const onCtx = (e) => { e.preventDefault(); violate('contextmenu'); };
  const onCopy = (e) => { e.preventDefault(); violate('copy'); };
  const onPaste = (e) => { e.preventDefault(); violate('paste'); };
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && ['c','v','u','s','p','a'].includes(e.key.toLowerCase())) { e.preventDefault(); violate('shortcut'); }
    if (e.key === 'F12') { e.preventDefault(); violate('devtools'); }
  };
  const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; violate('unload'); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);
  document.addEventListener('contextmenu', onCtx);
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCopy);
  document.addEventListener('paste', onPaste);
  document.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onBeforeUnload);
  function cleanup() {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('contextmenu', onCtx);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('cut', onCopy);
    document.removeEventListener('paste', onPaste);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
  }
  render();
}

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
async function pageJadwal() { await renderSchedule('schedule', 'Jadwal Pelajaran'); }
async function pageKegiatan() { await renderSchedule('activities', 'Jadwal Kegiatan'); }
async function renderSchedule(coll, label) {
  const snap = await getDocs(collection(db, coll));
  const items = []; snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  if (!items.length) return content.innerHTML = emptyState(`Belum ada ${label.toLowerCase()}`, 'Akan diperbarui oleh admin.');
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${label}</h3></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Hari/Tanggal</th><th>Waktu</th><th>${coll==='activities'?'Kegiatan':'Mata Pelajaran'}</th><th>Lokasi</th></tr></thead>
        <tbody>${items.map(s => `<tr><td><strong>${s.day || ''}</strong></td><td>${s.time || ''}</td><td>${s.title || ''}</td><td>${s.location || '-'}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

// ===== Rating OSIS =====
function pageRating() {
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
        userId: profile.uid, name: profile.name, gugus: profile.gugus,
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
      <thead><tr><th>Set Soal</th><th>Skor Otomatis</th><th>Nilai Akhir</th><th>Status</th></tr></thead>
      <tbody>${items.map(a => `<tr>
        <td><strong>${a.quizSet}</strong></td>
        <td>${a.autoScore || 0}/${a.maxAutoScore || 0}</td>
        <td>${a.finalScore != null ? `<strong style="color:var(--blue)">${a.finalScore}</strong>` : '-'}</td>
        <td>${a.finalScore != null ? '<span class="badge green">Sudah dinilai</span>' : '<span class="badge gold">Menunggu</span>'}</td>
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
        <div class="feature"><i class="fa-solid fa-people-group"></i><h4>Sistem Gugus</h4><p>5 gugus, kompetisi sehat</p></div>
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
