// ============================================================
// Admin Dashboard
// ============================================================
import { guardRoute, logout } from './auth.js';
import { db, SCHOOL_CONFIG } from './firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where,
  serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const { toast, btnLoading, showModal, hideModal } = window.MPLSUI;

let profile;
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const modal = document.getElementById('modal');
const modalBox = document.getElementById('modalBox');

(async () => {
  profile = await guardRoute('admin');
  document.getElementById('uName').textContent = profile.name || 'Admin';
  document.getElementById('avInit').textContent = (profile.name||'A').charAt(0).toUpperCase();
  setupNav(); loadPage('overview');
})();

document.getElementById('btnLogout').onclick = async () => { await logout(); location.href = 'admin-login.html'; };

function setupNav() {
  document.querySelectorAll('.sb-link').forEach(a => a.addEventListener('click', () => {
    document.querySelectorAll('.sb-link').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    loadPage(a.dataset.page);
    document.getElementById('sb').classList.remove('open');
  }));
}

const titles = { overview:'Ringkasan', soal:'Kelola Soal', materi:'Kelola Materi', jadwal:'Kelola Jadwal', kegiatan:'Kelola Kegiatan', jawaban:'Jawaban Siswa', absensi:'Absensi & Analitik', audit:'Audit Log Pelanggaran', rating:'Rating OSIS', export:'Export Nilai (CSV)' };

// Helper: render error panel + tombol retry agar tidak stuck "Memuat..."
function renderError(err, retryFn) {
  const msg = (err && err.message) ? err.message : String(err || 'Terjadi kesalahan');
  console.error('[admin]', err);
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3 style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> Gagal memuat halaman</h3></div>
      <p style="color:var(--muted);margin-bottom:14px">${msg}</p>
      <button class="btn btn-primary" id="btnRetry"><i class="fa-solid fa-rotate"></i> Coba Lagi</button>
    </div>`;
  document.getElementById('btnRetry').onclick = () => retryFn && retryFn();
}

// Wrapper agar setiap pageXxx tidak pernah membiarkan spinner stuck
function safePage(name, fn) {
  return async () => {
    try { await fn(); }
    catch (e) { renderError(e, () => loadPage(name)); }
  };
}

function loadPage(p) {
  pageTitle.textContent = titles[p] || p;
  content.innerHTML = '<div class="empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  const map = {
    overview: safePage('overview', pageOverview),
    soal:     safePage('soal',     pageSoal),
    materi:   safePage('materi',   pageMateri),
    jadwal:   safePage('jadwal',   () => pageSchedule('schedule')),
    kegiatan: safePage('kegiatan', () => pageSchedule('activities')),
    jawaban:  safePage('jawaban',  pageJawaban),
    absensi:  safePage('absensi',  pageAbsensi),
    audit:    safePage('audit',    pageAudit),
    rating:   safePage('rating',   pageRating),
    export:   safePage('export',   pageExport),
  };
  (map[p] || map.overview)();
}

// ===== Overview =====
async function pageOverview() {
  const safe = async (fn) => { try { return await fn(); } catch (e) { console.warn(e); return null; } };
  const [u, q, a, r, att] = await Promise.all([
    safe(() => getDocs(query(collection(db,'users'), where('role','==','student')))),
    safe(() => getDocs(collection(db,'questions'))),
    safe(() => getDocs(collection(db,'answers'))),
    safe(() => getDocs(collection(db,'ratings'))),
    safe(() => getDocs(collection(db,'attendance'))),
  ]);
  const ratings = []; r && r.forEach(d => ratings.push(d.data().rating || 0));
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '-';
  const v = (snap) => snap ? snap.size : '<span style="color:var(--red);font-size:.7em">!</span>';
  content.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top">Siswa Terdaftar <i class="fa-solid fa-users"></i></div><strong>${v(u)}</strong><small>Total akun</small></div>
      <div class="kpi"><div class="kpi-top">Soal <i class="fa-solid fa-file-pen"></i></div><strong>${v(q)}</strong><small>Total butir</small></div>
      <div class="kpi"><div class="kpi-top">Jawaban Masuk <i class="fa-solid fa-clipboard-check"></i></div><strong>${v(a)}</strong><small>Submission</small></div>
      <div class="kpi"><div class="kpi-top">Rating OSIS <i class="fa-solid fa-star"></i></div><strong>${avg}</strong><small>Rata-rata</small></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Aktivitas terbaru</h3></div>
      <p style="color:var(--muted)">Total absensi hari ini: <b>${att?att.size:'-'}</b>. Total submission soal: <b>${a?a.size:'-'}</b>. Selamat bertugas!</p>
    </div>`;
}

// ===== Soal CRUD =====
async function pageSoal() {
  const snap = await getDocs(collection(db,'questions'));
  const items = []; snap.forEach(d => items.push({ id:d.id, ...d.data() }));
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>Daftar Soal (${items.length})</h3>
        <div class="actions"><button class="btn btn-primary" id="addQ"><i class="fa-solid fa-plus"></i> Tambah Soal</button></div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Set</th><th>Pertanyaan</th><th>Tipe</th><th>Aksi</th></tr></thead>
        <tbody>${items.map(q => `<tr>
          <td><span class="badge blue">${q.quizSet||'Umum'}</span></td>
          <td>${q.text}</td>
          <td>${q.type==='mcq'?'Pilihan Ganda':'Isian'}</td>
          <td><button class="btn btn-danger" onclick="window.delQ('${q.id}')"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`).join('') || `<tr><td colspan="4" class="empty"><i class="fa-solid fa-inbox"></i>Belum ada soal</td></tr>`}</tbody>
      </table></div>
    </div>`;
  document.getElementById('addQ').onclick = openQModal;
}

window.delQ = async (id) => {
  if (!confirm('Hapus soal ini?')) return;
  try { await deleteDoc(doc(db,'questions',id)); toast('Soal dihapus', { type:'success' }); loadPage('soal'); }
  catch (e) { toast(e.message, { type:'error' }); }
};

function openQModal() {
  modalBox.innerHTML = `
    <div class="modal-head"><h3>Tambah Soal</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <div class="field"><label>Set Soal</label><div class="ctrl"><i class="fa-solid fa-folder"></i><input id="qSet" placeholder="Contoh: Pengenalan Sekolah" required></div></div>
      <div class="field"><label>Tipe</label><div class="ctrl"><i class="fa-solid fa-list"></i>
        <select id="qType"><option value="mcq">Pilihan Ganda</option><option value="text">Isian Singkat</option></select></div></div>
      <div class="field"><label>Pertanyaan</label><textarea id="qText" placeholder="Tulis pertanyaan..."></textarea></div>
      <div id="mcqArea">
        <div class="field"><label>Pilihan (pisahkan dengan baris baru)</label><textarea id="qOpts" placeholder="Pilihan A&#10;Pilihan B&#10;Pilihan C&#10;Pilihan D"></textarea></div>
        <div class="field"><label>Index Jawaban Benar (mulai 0)</label><div class="ctrl"><i class="fa-solid fa-check"></i><input type="number" id="qCor" min="0" value="0"></div></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close="modal">Batal</button>
      <button class="btn btn-primary" id="saveQ"><i class="fa-solid fa-save"></i> Simpan</button>
    </div>`;
  showModal('modal');
  document.getElementById('qType').onchange = (e) => {
    document.getElementById('mcqArea').style.display = e.target.value==='mcq'?'block':'none';
  };
  document.getElementById('saveQ').onclick = async () => {
    const data = {
      quizSet: document.getElementById('qSet').value.trim() || 'Umum',
      type: document.getElementById('qType').value,
      text: document.getElementById('qText').value.trim(),
      createdAt: serverTimestamp()
    };
    if (!data.text) return toast('Pertanyaan kosong', { type:'warning' });
    if (data.type==='mcq') {
      data.options = document.getElementById('qOpts').value.split('\n').map(s=>s.trim()).filter(Boolean);
      data.correctIndex = +document.getElementById('qCor').value;
    }
    try { await addDoc(collection(db,'questions'), data); hideModal('modal'); toast('Soal ditambahkan', { type:'success' }); loadPage('soal'); }
    catch(e) { toast(e.message, { type:'error' }); }
  };
}

// ===== Materi CRUD =====
async function pageMateri() {
  const snap = await getDocs(collection(db,'materials'));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Materi (${items.length})</h3>
        <div class="actions"><button class="btn btn-primary" id="addM"><i class="fa-solid fa-plus"></i> Tambah Materi</button></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Judul</th><th>Deskripsi</th><th>URL</th><th></th></tr></thead>
        <tbody>${items.map(m=>`<tr><td><strong>${m.title}</strong></td><td>${m.description||'-'}</td><td>${m.url?`<a href="${m.url}" target="_blank">Buka</a>`:'-'}</td><td><button class="btn btn-danger" onclick="window.delM('${m.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || `<tr><td colspan="4" class="empty">Belum ada materi</td></tr>`}</tbody>
      </table></div>
    </div>`;
  document.getElementById('addM').onclick = () => {
    modalBox.innerHTML = `
      <div class="modal-head"><h3>Tambah Materi</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Judul</label><div class="ctrl"><i class="fa-solid fa-heading"></i><input id="mT"></div></div>
        <div class="field"><label>Deskripsi</label><textarea id="mD"></textarea></div>
        <div class="field"><label>URL (opsional)</label><div class="ctrl"><i class="fa-solid fa-link"></i><input id="mU" placeholder="https://..."></div></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close="modal">Batal</button><button class="btn btn-primary" id="sM">Simpan</button></div>`;
    showModal('modal');
    document.getElementById('sM').onclick = async () => {
      const t = document.getElementById('mT').value.trim();
      if (!t) return toast('Judul wajib', { type:'warning' });
      try {
        await addDoc(collection(db,'materials'), { title:t, description:document.getElementById('mD').value.trim(), url:document.getElementById('mU').value.trim(), createdAt: serverTimestamp() });
        hideModal('modal'); toast('Materi ditambahkan', { type:'success' }); loadPage('materi');
      } catch(e) { toast(e.message, { type:'error' }); }
    };
  };
}
window.delM = async (id) => {
  if(!confirm('Hapus?')) return;
  try { await deleteDoc(doc(db,'materials',id)); toast('Dihapus',{type:'success'}); loadPage('materi'); }
  catch(e) { toast(e.message,{type:'error'}); }
};

// ===== Schedule CRUD =====
async function pageSchedule(coll) {
  const isAct = coll==='activities';
  const snap = await getDocs(collection(db, coll));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${isAct?'Jadwal Kegiatan':'Jadwal Pelajaran'} (${items.length})</h3>
        <div class="actions"><button class="btn btn-primary" id="addS"><i class="fa-solid fa-plus"></i> Tambah</button></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Hari/Tanggal</th><th>Waktu</th><th>${isAct?'Kegiatan':'Mata Pelajaran'}</th><th>Lokasi</th><th></th></tr></thead>
        <tbody>${items.map(s=>`<tr><td>${s.day||''}</td><td>${s.time||''}</td><td>${s.title||''}</td><td>${s.location||'-'}</td><td><button class="btn btn-danger" onclick="window.delS('${coll}','${s.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || `<tr><td colspan="5" class="empty">Kosong</td></tr>`}</tbody>
      </table></div>
    </div>`;
  document.getElementById('addS').onclick = () => {
    modalBox.innerHTML = `
      <div class="modal-head"><h3>Tambah ${isAct?'Kegiatan':'Jadwal'}</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body">
        <div class="field-row">
          <div class="field"><label>Hari/Tanggal</label><div class="ctrl"><i class="fa-solid fa-calendar"></i><input id="sD" placeholder="Senin / 22 Jul 2025"></div></div>
          <div class="field"><label>Waktu</label><div class="ctrl"><i class="fa-solid fa-clock"></i><input id="sT" placeholder="07.00 - 09.00"></div></div>
        </div>
        <div class="field"><label>${isAct?'Nama Kegiatan':'Mata Pelajaran'}</label><div class="ctrl"><i class="fa-solid fa-bookmark"></i><input id="sN"></div></div>
        <div class="field"><label>Lokasi</label><div class="ctrl"><i class="fa-solid fa-location-dot"></i><input id="sL" placeholder="Aula / R. Kelas"></div></div>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close="modal">Batal</button><button class="btn btn-primary" id="ss">Simpan</button></div>`;
    showModal('modal');
    document.getElementById('ss').onclick = async () => {
      const data = { day:document.getElementById('sD').value, time:document.getElementById('sT').value, title:document.getElementById('sN').value, location:document.getElementById('sL').value, createdAt: serverTimestamp() };
      if (!data.title) return toast('Judul wajib', { type:'warning' });
      try {
        await addDoc(collection(db, coll), data);
        hideModal('modal'); toast('Disimpan', { type:'success' });
        loadPage(isAct?'kegiatan':'jadwal');
      } catch(e) { toast(e.message, { type:'error' }); }
    };
  };
}
window.delS = async (c,id) => {
  if(!confirm('Hapus?')) return;
  try { await deleteDoc(doc(db,c,id)); toast('Dihapus',{type:'success'}); loadPage(c==='activities'?'kegiatan':'jadwal'); }
  catch(e) { toast(e.message,{type:'error'}); }
};

// ===== Jawaban + Penilaian =====
async function pageJawaban() {
  const snap = await getDocs(collection(db,'answers'));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  const filter = `<select id="fGugus" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px"><option value="">Semua Gugus</option>${SCHOOL_CONFIG.groups.map(g=>`<option>${g}</option>`).join('')}</select>`;
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>Jawaban Siswa (${items.length})</h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${filter}
          <button class="btn btn-danger" id="btnResetNilai" title="Hapus semua nilai & jawaban siswa (reset progres)"><i class="fa-solid fa-trash-can"></i> Hapus Semua Nilai</button>
        </div>
      </div>
      <div class="table-wrap"><table class="tbl" id="tblA">
        <thead><tr><th>Siswa</th><th>Gugus</th><th>Set</th><th>Skor Auto</th><th>Pelanggaran</th><th>Nilai Akhir</th><th>Aksi</th></tr></thead>
        <tbody></tbody>
      </table></div>
    </div>`;
  document.getElementById('btnResetNilai').onclick = () => window.resetAllNilai();
  const render = (filterG='') => {
    const tbody = content.querySelector('tbody');
    const list = items.filter(a => !filterG || a.gugus===filterG);
    tbody.innerHTML = list.map(a => `<tr>
      <td><strong>${a.name}</strong><br><small style="color:var(--muted)">${a.kelas||''}</small></td>
      <td><span class="badge blue">${a.gugus||'-'}</span></td>
      <td>${a.quizSet}</td>
      <td>${a.autoScore||0}/${a.maxAutoScore||0}</td>
      <td>${a.violations ? `<span class="badge red">${a.violations}</span>` : '<span class="badge green">0</span>'}</td>
      <td>${a.finalScore!=null?`<strong>${a.finalScore}</strong>`:'<span class="badge gold">Belum</span>'}</td>
      <td><button class="btn btn-outline" onclick="window.gradeA('${a.id}', ${a.autoScore||0})"><i class="fa-solid fa-pen"></i> Nilai</button></td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty">Belum ada jawaban</td></tr>`;
  };
  render();
  document.getElementById('fGugus').onchange = (e) => render(e.target.value);
}
window.gradeA = (id, suggested) => {
  const v = prompt('Masukkan nilai akhir (0-100):', suggested);
  if (v == null) return;
  const n = +v; if (isNaN(n) || n<0 || n>100) return toast('Nilai tidak valid', {type:'error'});
  updateDoc(doc(db,'answers',id), { finalScore:n, gradedAt: serverTimestamp() })
    .then(() => { toast('Nilai disimpan', { type:'success' }); loadPage('jawaban'); })
    .catch(e => toast(e.message, { type:'error' }));
};

// ===== Absensi + Analitik =====
async function pageAbsensi() {
  const snap = await getDocs(collection(db,'attendance'));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));

  const STATUSES = ['hadir','izin','sakit'];
  const totalsByStatus = { hadir:0, izin:0, sakit:0 };
  const perGugus = {};
  SCHOOL_CONFIG.groups.forEach(g => perGugus[g] = { hadir:0, izin:0, sakit:0, total:0 });
  items.forEach(a => {
    const s = (a.status || 'hadir').toLowerCase();
    if (STATUSES.includes(s)) totalsByStatus[s]++;
    const g = a.gugus;
    if (g && perGugus[g]) { if (STATUSES.includes(s)) perGugus[g][s]++; perGugus[g].total++; }
  });

  // Foto izin/sakit (yang punya faceImage)
  const izinSakit = items.filter(a => {
    const s = (a.status||'').toLowerCase();
    return (s==='izin' || s==='sakit') && a.faceImage;
  }).sort((a,b)=> (b.date||'').localeCompare(a.date||''));

  const gugusFilter = `<select id="fG" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px"><option value="">Semua Gugus</option>${SCHOOL_CONFIG.groups.map(g=>`<option>${g}</option>`).join('')}</select>`;
  const dateFilter = `<input type="date" id="fD" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px">`;
  const statusFilter = `<select id="fS" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px"><option value="">Semua Status</option><option>hadir</option><option>izin</option><option>sakit</option></select>`;

  content.innerHTML = `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-head">
        <h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Aksi Reset</h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-danger" id="btnResetAbsen"><i class="fa-solid fa-trash-can"></i> Hapus Semua Data Absensi</button>
        </div>
      </div>
      <p style="color:var(--muted);margin:0">Gunakan tombol ini untuk mereset progres absensi siswa di kemudian hari. Tindakan ini <b>permanen</b> dan tidak bisa dibatalkan.</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top">Hadir <i class="fa-solid fa-circle-check"></i></div><strong style="color:var(--green)">${totalsByStatus.hadir}</strong><small>Verifikasi GPS</small></div>
      <div class="kpi"><div class="kpi-top">Izin <i class="fa-solid fa-envelope-open-text"></i></div><strong style="color:var(--gold)">${totalsByStatus.izin}</strong><small>Verifikasi wajah</small></div>
      <div class="kpi"><div class="kpi-top">Sakit <i class="fa-solid fa-briefcase-medical"></i></div><strong style="color:var(--red)">${totalsByStatus.sakit}</strong><small>Verifikasi wajah</small></div>
      <div class="kpi"><div class="kpi-top">Total Catatan <i class="fa-solid fa-list-check"></i></div><strong>${items.length}</strong><small>Semua absensi</small></div>
    </div>

    <div class="grid-3" style="grid-template-columns:1fr 1fr;gap:18px">
      <div class="panel">
        <div class="panel-head"><h3>Distribusi Status</h3></div>
        <div style="height:280px"><canvas id="chartStatus"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Absensi per Gugus</h3></div>
        <div style="height:280px"><canvas id="chartGugus"></canvas></div>
      </div>
    </div>

    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><h3>Unduh CSV per Gugus</h3></div>
      <p style="color:var(--muted);margin-bottom:14px">Setiap gugus dapat diunduh terpisah. File CSV memuat semua status (hadir, izin, sakit).</p>
      <div class="grid-3">
        ${SCHOOL_CONFIG.groups.map(g => `
          <div class="card">
            <div class="card-icon"><i class="fa-solid fa-file-csv"></i></div>
            <h3>${g}</h3>
            <p>${perGugus[g].total} catatan · H:${perGugus[g].hadir} I:${perGugus[g].izin} S:${perGugus[g].sakit}</p>
            <button class="btn btn-primary" style="margin-top:12px" onclick="window.dlAbsenCsv('${g}')"><i class="fa-solid fa-download"></i> Download Absen ${g}</button>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-gold" onclick="window.dlAbsenCsv('')"><i class="fa-solid fa-download"></i> Download Semua Gugus</button>
        <button class="btn btn-outline" onclick="window.dlAbsenAllSeparate()"><i class="fa-solid fa-file-zipper"></i> Download Terpisah Sekaligus (5 file)</button>
      </div>
    </div>

    <!-- ===== FOTO IZIN / SAKIT (BARU) ===== -->
    <div class="panel" style="margin-top:18px">
      <div class="panel-head">
        <h3><i class="fa-solid fa-id-card-clip" style="color:var(--gold)"></i> Foto Bukti Izin / Sakit (${izinSakit.length})</h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="fizGugus" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px">
            <option value="">Semua Gugus</option>
            ${SCHOOL_CONFIG.groups.map(g=>`<option>${g}</option>`).join('')}
          </select>
          <select id="fizStatus" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px">
            <option value="">Izin & Sakit</option><option value="izin">Izin saja</option><option value="sakit">Sakit saja</option>
          </select>
        </div>
      </div>
      <p style="color:var(--muted);margin-bottom:14px">Foto verifikasi wajah siswa yang absen <b>izin</b> atau <b>sakit</b>. Foto bisa diunduh atau dihapus oleh admin.</p>
      <div id="izinSakitGrid" class="grid-3" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px"></div>
    </div>

    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><h3>Detail Absensi</h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">${gugusFilter}${statusFilter}${dateFilter}</div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Tanggal</th><th>Siswa</th><th>Gugus</th><th>Status</th><th>Bukti</th><th>Detail</th></tr></thead>
        <tbody id="absTbody"></tbody>
      </table></div>
    </div>`;

  const cs = document.getElementById('chartStatus').getContext('2d');
  new Chart(cs, {
    type:'doughnut',
    data:{ labels:['Hadir','Izin','Sakit'], datasets:[{ data:[totalsByStatus.hadir,totalsByStatus.izin,totalsByStatus.sakit], backgroundColor:['#16a34a','#c9a24a','#dc2626'], borderWidth:0 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' }}}
  });
  const cg = document.getElementById('chartGugus').getContext('2d');
  new Chart(cg, {
    type:'bar',
    data:{ labels:SCHOOL_CONFIG.groups, datasets:[
      { label:'Hadir', data:SCHOOL_CONFIG.groups.map(g=>perGugus[g].hadir), backgroundColor:'#16a34a' },
      { label:'Izin',  data:SCHOOL_CONFIG.groups.map(g=>perGugus[g].izin),  backgroundColor:'#c9a24a' },
      { label:'Sakit', data:SCHOOL_CONFIG.groups.map(g=>perGugus[g].sakit), backgroundColor:'#dc2626' },
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' }}, scales:{ x:{ stacked:true }, y:{ stacked:true, beginAtZero:true, ticks:{ precision:0 }}}}
  });

  window.__absMap = Object.fromEntries(items.map(a => [a.id, a]));

  const grid = document.getElementById('izinSakitGrid');
  const renderIzinSakit = () => {
    const fg = document.getElementById('fizGugus').value;
    const fs = document.getElementById('fizStatus').value;
    const list = izinSakit.filter(a => (!fg || a.gugus===fg) && (!fs || (a.status||'').toLowerCase()===fs));
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-camera-retro"></i><p>Belum ada foto izin / sakit</p></div>`;
      return;
    }
    grid.innerHTML = list.map(a => {
      const s = (a.status||'').toLowerCase();
      const badge = s==='izin'
        ? '<span class="badge gold">Izin</span>'
        : '<span class="badge red">Sakit</span>';
      return `
        <div class="card" style="padding:10px;text-align:left">
          <div style="aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#000;cursor:pointer" onclick="window.viewFace('${a.id}')">
            <img src="${a.faceImage}" alt="Foto ${a.name}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">
          </div>
          <div style="margin-top:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <strong style="font-size:14px;line-height:1.2">${a.name||'-'}</strong>${badge}
            </div>
            <div style="color:var(--muted);font-size:12px;margin-top:4px">
              <span class="badge blue" style="font-size:10px">${a.gugus||'-'}</span>
              · ${a.kelas||'-'} · ${a.date||'-'}
            </div>
            ${a.reason?`<div style="color:var(--muted);font-size:12px;margin-top:6px"><i class="fa-solid fa-quote-left" style="opacity:.5"></i> ${a.reason}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn btn-outline" style="flex:1;padding:8px" onclick="window.dlFace('${a.id}')" title="Download foto"><i class="fa-solid fa-download"></i></button>
            <button class="btn btn-outline" style="flex:1;padding:8px" onclick="window.viewFace('${a.id}')" title="Lihat besar"><i class="fa-solid fa-expand"></i></button>
            <button class="btn btn-danger" style="flex:1;padding:8px" onclick="window.delAbsen('${a.id}')" title="Hapus absensi"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
    }).join('');
  };
  document.getElementById('fizGugus').onchange = renderIzinSakit;
  document.getElementById('fizStatus').onchange = renderIzinSakit;
  renderIzinSakit();

  const tbody = document.getElementById('absTbody');
  const renderRows = () => {
    const fg = document.getElementById('fG').value;
    const fs = document.getElementById('fS').value;
    const fd = document.getElementById('fD').value;
    const list = items.filter(a =>
      (!fg || a.gugus===fg) && (!fs || (a.status||'hadir')===fs) && (!fd || a.date===fd)
    ).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    tbody.innerHTML = list.map(a => {
      const s = (a.status||'hadir');
      const badge = s==='hadir' ? '<span class="badge green">Hadir</span>'
                  : s==='izin' ? '<span class="badge gold">Izin</span>'
                  : '<span class="badge red">Sakit</span>';
      const bukti = a.faceImage
        ? `<button class="btn btn-outline" onclick="window.viewFace('${a.id}')"><i class="fa-solid fa-image"></i> Foto</button>`
        : (a.lat ? `<small>${a.lat?.toFixed?.(4)}, ${a.lng?.toFixed?.(4)} (${a.distance}m)</small>` : '-');
      const detail = a.reason ? `<small>${a.reason}</small>` : '-';
      return `<tr><td>${a.date||'-'}</td><td><strong>${a.name}</strong><br><small style="color:var(--muted)">${a.kelas||''}</small></td><td><span class="badge blue">${a.gugus||'-'}</span></td><td>${badge}</td><td>${bukti}</td><td>${detail}</td></tr>`;
    }).join('') || `<tr><td colspan="6" class="empty">Tidak ada data</td></tr>`;
  };
  document.getElementById('fG').onchange = renderRows;
  document.getElementById('fS').onchange = renderRows;
  document.getElementById('fD').onchange = renderRows;
  const _btnRA = document.getElementById('btnResetAbsen');
  if (_btnRA) _btnRA.onclick = () => window.resetAllAbsen();
  renderRows();
}

// ===== Reset semua absensi & nilai (bulk delete) =====
window.resetAllAbsen = async () => {
  const ok1 = confirm('⚠️ PERINGATAN!\n\nTindakan ini akan MENGHAPUS SEMUA data absensi siswa (hadir, izin, sakit) secara PERMANEN.\n\nGunakan fitur ini untuk mereset progres absensi di kemudian hari.\n\nLanjutkan?');
  if (!ok1) return;
  const typed = prompt('Ketik "HAPUS ABSENSI" (tanpa tanda kutip) untuk konfirmasi:');
  if (typed !== 'HAPUS ABSENSI') return toast('Dibatalkan', { type:'warning' });
  try {
    const snap = await getDocs(collection(db,'attendance'));
    const jobs = [];
    snap.forEach(d => jobs.push(deleteDoc(doc(db,'attendance',d.id))));
    await Promise.all(jobs);
    toast(`${jobs.length} data absensi dihapus`, { type:'success' });
    loadPage('absensi');
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.resetAllNilai = async () => {
  const ok1 = confirm('⚠️ PERINGATAN!\n\nTindakan ini akan MENGHAPUS SEMUA jawaban & nilai siswa secara PERMANEN.\n\nGunakan fitur ini untuk mereset progres siswa di kemudian hari.\n\nLanjutkan?');
  if (!ok1) return;
  const typed = prompt('Ketik "HAPUS NILAI" (tanpa tanda kutip) untuk konfirmasi:');
  if (typed !== 'HAPUS NILAI') return toast('Dibatalkan', { type:'warning' });
  try {
    const snap = await getDocs(collection(db,'answers'));
    const jobs = [];
    snap.forEach(d => jobs.push(deleteDoc(doc(db,'answers',d.id))));
    await Promise.all(jobs);
    toast(`${jobs.length} jawaban & nilai dihapus`, { type:'success' });
    loadPage('jawaban');
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.viewFace = (id) => {
  const a = window.__absMap?.[id]; if (!a?.faceImage) return;
  modalBox.innerHTML = `
    <div class="modal-head"><h3>Verifikasi Wajah · ${a.name}</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body" style="text-align:center">
      <p style="color:var(--muted);margin-bottom:10px"><b>${a.status?.toUpperCase()}</b> · ${a.date} · ${a.gugus||'-'}<br>Alasan: ${a.reason||'-'}</p>
      <img src="${a.faceImage}" style="max-width:100%;border-radius:14px;border:1px solid var(--line)">
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" onclick="window.dlFace('${a.id}')"><i class="fa-solid fa-download"></i> Download Foto</button>
      <button class="btn btn-danger" onclick="window.delAbsen('${a.id}')"><i class="fa-solid fa-trash"></i> Hapus Absensi</button>
      <button class="btn btn-primary" data-close="modal">Tutup</button>
    </div>`;
  showModal('modal');
};

window.dlFace = (id) => {
  const a = window.__absMap?.[id]; if (!a?.faceImage) return toast('Foto tidak tersedia', { type:'warning' });
  try {
    const src = a.faceImage;
    const link = document.createElement('a');
    link.href = src;
    const safeName = (a.name||'siswa').replace(/[^a-zA-Z0-9]+/g,'_');
    let ext = 'jpg';
    const m = /^data:image\/([a-zA-Z0-9+]+);/.exec(src);
    if (m) ext = m[1].replace('jpeg','jpg');
    link.download = `bukti_${(a.status||'absen')}_${safeName}_${a.date||'tgl'}.${ext}`;
    document.body.appendChild(link); link.click(); link.remove();
    toast('Foto diunduh', { type:'success' });
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.delAbsen = async (id) => {
  const a = window.__absMap?.[id]; if (!a) return;
  if (!confirm(`Hapus absensi ${a.name||''} (${a.status||''}) tanggal ${a.date||''}?\nFoto bukti juga akan ikut terhapus.`)) return;
  try {
    await deleteDoc(doc(db,'attendance',id));
    toast('Absensi dihapus', { type:'success' });
    hideModal('modal');
    loadPage('absensi');
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.dlAbsenCsv = async (gugus) => {
  try {
    const snap = await getDocs(collection(db,'attendance'));
    const rows = [['Tanggal','Nama','NIS','Kelas','Gugus','Status','Alasan','Latitude','Longitude','Jarak (m)','Akurasi (m)','Verifikasi Wajah']];
    snap.forEach(d => {
      const a = d.data();
      if (gugus && a.gugus !== gugus) return;
      rows.push([
        a.date||'', a.name||'', a.nis||'', a.kelas||'', a.gugus||'',
        a.status||'hadir', a.reason||'',
        a.lat ?? '', a.lng ?? '', a.distance ?? '', a.accuracy ?? '',
        a.faceVerified ? 'Ya' : 'Tidak'
      ]);
    });
    if (rows.length === 1) return toast('Tidak ada data untuk diunduh', { type:'warning' });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `absensi_${(gugus||'semua').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast(`CSV absensi ${gugus||'semua'} diunduh`, { type:'success' });
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.dlAbsenAllSeparate = async () => {
  for (const g of SCHOOL_CONFIG.groups) {
    await window.dlAbsenCsv(g);
    await new Promise(r => setTimeout(r, 350));
  }
};

// ===== Audit Log =====
async function pageAudit() {
  const snap = await getDocs(collection(db,'auditLogs'));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

  const byUser = {};
  items.forEach(l => {
    const k = l.userId;
    if (!byUser[k]) byUser[k] = { name:l.name, gugus:l.gugus, total:0, penalty:0 };
    byUser[k].total++; byUser[k].penalty += (l.penalty||0);
  });
  const top = Object.entries(byUser).sort((a,b)=>b[1].penalty - a[1].penalty).slice(0,5);

  content.innerHTML = `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-head" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Aksi Audit Log</h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="window.dlAuditCsv()"><i class="fa-solid fa-download"></i> Download CSV</button>
          <button class="btn btn-danger" id="btnResetAudit"><i class="fa-solid fa-trash-can"></i> Hapus Semua Audit Log</button>
        </div>
      </div>
      <p style="color:var(--muted);margin:0">Tindakan hapus akan menghapus seluruh log pelanggaran secara <b>permanen</b> dan tidak dapat dibatalkan.</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top">Total Pelanggaran <i class="fa-solid fa-triangle-exclamation"></i></div><strong>${items.length}</strong><small>Semua waktu</small></div>
      <div class="kpi"><div class="kpi-top">Total Penalti <i class="fa-solid fa-minus"></i></div><strong style="color:var(--red)">${items.reduce((s,a)=>s+(a.penalty||0),0)}</strong><small>Poin dikurangi</small></div>
      <div class="kpi"><div class="kpi-top">Siswa Terpantau <i class="fa-solid fa-user-shield"></i></div><strong>${Object.keys(byUser).length}</strong><small>Pernah melanggar</small></div>
      <div class="kpi"><div class="kpi-top">Jenis Pelanggaran <i class="fa-solid fa-list"></i></div><strong>${new Set(items.map(i=>i.type)).size}</strong><small>Tipe unik</small></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Top 5 Siswa dengan Penalti Tertinggi</h3>
        <div class="actions"><button class="btn btn-outline" onclick="window.dlAuditCsv()"><i class="fa-solid fa-download"></i> Download Audit CSV</button></div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Siswa</th><th>Gugus</th><th>Pelanggaran</th><th>Total Penalti</th></tr></thead>
        <tbody>${top.map(([uid,v],i)=>`<tr><td>${i+1}</td><td><strong>${v.name}</strong></td><td><span class="badge blue">${v.gugus||'-'}</span></td><td>${v.total}</td><td><strong style="color:var(--red)">-${v.penalty}</strong></td></tr>`).join('') || `<tr><td colspan="5" class="empty">Belum ada pelanggaran</td></tr>`}</tbody>
      </table></div>
    </div>

    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><h3>Riwayat Pelanggaran (terbaru)</h3></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Waktu</th><th>Siswa</th><th>Gugus</th><th>Set Soal</th><th>Tipe</th><th>Pesan</th><th>Penalti</th></tr></thead>
        <tbody>${items.slice(0,200).map(l => {
          const t = l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000).toLocaleString('id-ID') : '-';
          return `<tr><td><small>${t}</small></td><td><strong>${l.name||'-'}</strong></td><td><span class="badge blue">${l.gugus||'-'}</span></td><td>${l.quizSet||'-'}</td><td><code style="font-size:11px">${l.type}</code></td><td>${l.message||''}</td><td><span class="badge red">-${l.penalty||0}</span></td></tr>`;
        }).join('') || `<tr><td colspan="7" class="empty">Belum ada log</td></tr>`}</tbody>
      </table></div>
    </div>`;

  window.__auditItems = items;

  const _btnRA = document.getElementById('btnResetAudit');
  if (_btnRA) _btnRA.onclick = () => window.resetAllAudit();
}

window.resetAllAudit = async () => {
  const ok1 = confirm('⚠️ PERINGATAN!\n\nTindakan ini akan MENGHAPUS SEMUA audit log pelanggaran secara PERMANEN.\n\nLanjutkan?');
  if (!ok1) return;
  const typed = prompt('Ketik "HAPUS AUDIT" (tanpa tanda kutip) untuk konfirmasi:');
  if (typed !== 'HAPUS AUDIT') return toast('Dibatalkan', { type:'warning' });
  try {
    const snap = await getDocs(collection(db,'auditLogs'));
    const jobs = [];
    snap.forEach(d => jobs.push(deleteDoc(doc(db,'auditLogs',d.id))));
    await Promise.all(jobs);
    toast(`${jobs.length} audit log dihapus`, { type:'success' });
    loadPage('audit');
  } catch(e) { toast(e.message, { type:'error' }); }
};

window.dlAuditCsv = () => {
  const items = window.__auditItems || [];
  if (!items.length) return toast('Tidak ada data', { type:'warning' });
  const rows = [['Waktu','Nama','Gugus','Kelas','Set Soal','Tipe','Pesan','Penalti','UserAgent']];
  items.forEach(l => {
    const t = l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000).toISOString() : '';
    rows.push([t, l.name||'', l.gugus||'', l.kelas||'', l.quizSet||'', l.type||'', l.message||'', l.penalty||0, l.userAgent||'']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit_log_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Audit log diunduh', { type:'success' });
};

// ===== Rating OSIS =====
async function pageRating() {
  const snap = await getDocs(collection(db,'ratings'));
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  const avg = items.length ? (items.reduce((a,b)=>a+(b.rating||0),0)/items.length).toFixed(2) : '-';
  content.innerHTML = `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-head" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <h3><i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Aksi Reset</h3>
        <button class="btn btn-danger" id="btnResetRating"><i class="fa-solid fa-trash-can"></i> Hapus Semua Rating</button>
      </div>
      <p style="color:var(--muted);margin:0">Tindakan ini akan menghapus seluruh rating & komentar OSIS secara <b>permanen</b> dan tidak bisa dibatalkan.</p>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top">Total Rating <i class="fa-solid fa-star"></i></div><strong>${items.length}</strong></div>
      <div class="kpi"><div class="kpi-top">Rata-rata <i class="fa-solid fa-star-half-stroke"></i></div><strong>${avg} <small style="color:var(--gold)">/5</small></strong></div>
    </div>
    <div class="panel"><div class="panel-head"><h3>Komentar</h3></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Siswa</th><th>Gugus</th><th>Rating</th><th>Komentar</th></tr></thead>
        <tbody>${items.map(r=>`<tr><td><strong>${r.name}</strong></td><td><span class="badge blue">${r.gugus||'-'}</span></td><td>${'★'.repeat(r.rating||0)}<span style="color:var(--line)">${'★'.repeat(5-(r.rating||0))}</span></td><td>${r.comment||'-'}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">Belum ada rating</td></tr>`}</tbody>
      </table></div></div>`;
  const _btnRR = document.getElementById('btnResetRating');
  if (_btnRR) _btnRR.onclick = () => window.resetAllRating();
}

window.resetAllRating = async () => {
  const ok1 = confirm('⚠️ PERINGATAN!\n\nTindakan ini akan MENGHAPUS SEMUA rating & komentar OSIS secara PERMANEN.\n\nLanjutkan?');
  if (!ok1) return;
  const typed = prompt('Ketik "HAPUS RATING" (tanpa tanda kutip) untuk konfirmasi:');
  if (typed !== 'HAPUS RATING') return toast('Dibatalkan', { type:'warning' });
  try {
    const snap = await getDocs(collection(db,'ratings'));
    const jobs = [];
    snap.forEach(d => jobs.push(deleteDoc(doc(db,'ratings',d.id))));
    await Promise.all(jobs);
    toast(`${jobs.length} rating dihapus`, { type:'success' });
    loadPage('rating');
  } catch(e) { toast(e.message, { type:'error' }); }
};

// ===== Export CSV per Gugus =====
async function pageExport() {
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Unduh Nilai per Gugus</h3></div>
      <p style="color:var(--muted);margin-bottom:18px">Unduh nilai siswa yang sudah dinilai dalam format CSV (kompatibel Excel & Google Sheets).</p>
      <div class="grid-3">
        ${SCHOOL_CONFIG.groups.map(g => `
          <div class="card">
            <div class="card-icon"><i class="fa-solid fa-file-csv"></i></div>
            <h3>${g}</h3>
            <p>Unduh seluruh nilai untuk ${g}.</p>
            <button class="btn btn-primary" style="margin-top:12px" onclick="window.dlCsv('${g}')"><i class="fa-solid fa-download"></i> Download CSV</button>
          </div>`).join('')}
      </div>
      <div style="margin-top:18px"><button class="btn btn-gold" onclick="window.dlCsv('')"><i class="fa-solid fa-download"></i> Download Semua Gugus</button></div>
    </div>`;
}
window.dlCsv = async (gugus) => {
  try {
    const snap = await getDocs(collection(db,'answers'));
    const rows = [['Nama','NIS','Kelas','Gugus','Set Soal','Skor Otomatis','Skor Maks','Nilai Akhir','Pelanggaran']];
    snap.forEach(d => {
      const a = d.data();
      if (gugus && a.gugus !== gugus) return;
      if (a.finalScore == null) return;
      rows.push([a.name, a.nis||'', a.kelas||'', a.gugus||'', a.quizSet||'', a.autoScore||0, a.maxAutoScore||0, a.finalScore, a.violations||0]);
    });
    if (rows.length === 1) return toast('Tidak ada data untuk diunduh', { type:'warning' });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nilai_${gugus||'semua'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('CSV diunduh', { type:'success' });
  } catch(e) { toast(e.message, { type:'error' }); }
};
