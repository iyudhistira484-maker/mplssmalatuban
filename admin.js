// Admin Dashboard
import { guardRoute, logout } from './auth.js';
import { db, SCHOOL_CONFIG } from './firebase-config.js';
import {
  collection, getDocs, getDoc, addDoc, deleteDoc, doc, updateDoc, query, where,
  serverTimestamp, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const { toast, btnLoading, showModal, hideModal } = window.MPLSUI;

let profile;
let pageUnsubscribe = null;
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

const titles = { overview:'Ringkasan', soal:'Kelola Soal', materi:'Kelola Materi', jadwal:'Jadwal Kegiatan', jawaban:'Jawaban Siswa', absensi:'Absensi & Analitik', audit:'Audit Log Pelanggaran', rating:'Rating OSIS', export:'Export Nilai (CSV)' };

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
  if (pageUnsubscribe) { pageUnsubscribe(); pageUnsubscribe = null; }
  pageTitle.textContent = titles[p] || p;
  content.innerHTML = '<div class="empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Memuat...</p></div>';
  // sync bottom nav
  if (window.mbnSetActive) window.mbnSetActive(p);
  // sync sidebar links
  document.querySelectorAll('.sb-link').forEach(x => x.classList.remove('active'));
  const active = document.querySelector(`.sb-link[data-page="${p}"]`);
  if (active) active.classList.add('active');
  const map = {
    overview: safePage('overview', pageOverview),
    soal:     safePage('soal',     pageSoal),
    materi:   safePage('materi',   pageMateri),
    jadwal:   safePage('jadwal',   pageSchedule),
    jawaban:  safePage('jawaban',  pageJawaban),
    absensi:  safePage('absensi',  pageAbsensi),
    audit:    safePage('audit',    pageAudit),
    rating:   safePage('rating',   pageRating),
    export:   safePage('export',   pageExport),
  };
  (map[p] || map.overview)();
}
window.loadPage = loadPage;

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
  const v = (snap) => snap ? snap.size : '—';
  const now = new Date();
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const adminName = document.getElementById('uName')?.textContent || 'Admin';

  content.innerHTML = `
    <div class="db-welcome">
      <div class="db-welcome-text">
        <span class="db-welcome-label">Selamat datang kembali</span>
        <h2 class="db-welcome-name">${adminName}</h2>
        <span class="db-welcome-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
      </div>
      <div class="db-welcome-icon"><i class="fa-solid fa-user-shield"></i></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi kpi-red">
        <div class="kpi-icon"><i class="fa-solid fa-users"></i></div>
        <div class="kpi-body">
          <strong>${v(u)}</strong>
          <span class="kpi-label">Siswa Terdaftar</span>
          <small>Total akun aktif</small>
        </div>
      </div>
      <div class="kpi kpi-gold">
        <div class="kpi-icon"><i class="fa-solid fa-file-pen"></i></div>
        <div class="kpi-body">
          <strong>${v(q)}</strong>
          <span class="kpi-label">Butir Soal</span>
          <small>Tersedia di sistem</small>
        </div>
      </div>
      <div class="kpi kpi-green">
        <div class="kpi-icon"><i class="fa-solid fa-clipboard-check"></i></div>
        <div class="kpi-body">
          <strong>${v(a)}</strong>
          <span class="kpi-label">Jawaban Masuk</span>
          <small>Total submission</small>
        </div>
      </div>
      <div class="kpi kpi-brown">
        <div class="kpi-icon"><i class="fa-solid fa-star"></i></div>
        <div class="kpi-body">
          <strong>${avg}</strong>
          <span class="kpi-label">Rating OSIS</span>
          <small>Rata-rata bintang</small>
        </div>
      </div>
    </div>

    <div class="db-row">
      <div class="panel db-activity">
        <div class="panel-head"><h3><i class="fa-solid fa-chart-line" style="color:var(--secondary);margin-right:6px"></i>Ringkasan Hari Ini</h3></div>
        <div class="db-stat-list">
          <div class="db-stat-item">
            <span class="db-stat-dot dot-green"></span>
            <span class="db-stat-key">Absensi tercatat</span>
            <b>${att?att.size:'—'}</b>
          </div>
          <div class="db-stat-item">
            <span class="db-stat-dot dot-gold"></span>
            <span class="db-stat-key">Submission soal</span>
            <b>${a?a.size:'—'}</b>
          </div>
          <div class="db-stat-item">
            <span class="db-stat-dot dot-red"></span>
            <span class="db-stat-key">Siswa terdaftar</span>
            <b>${u?u.size:'—'}</b>
          </div>
          <div class="db-stat-item">
            <span class="db-stat-dot dot-brown"></span>
            <span class="db-stat-key">Rating rata-rata</span>
            <b>${avg} <i class="fa-solid fa-star" style="font-size:.75em;color:var(--secondary)"></i></b>
          </div>
        </div>
      </div>

      <div class="panel db-quick">
        <div class="panel-head"><h3><i class="fa-solid fa-bolt" style="color:var(--secondary);margin-right:6px"></i>Akses Cepat</h3></div>
        <div class="db-quick-grid">
          <button class="db-quick-btn" onclick="window.loadPage('soal')">
            <i class="fa-solid fa-file-pen"></i>
            <span>Soal</span>
          </button>
          <button class="db-quick-btn" onclick="window.loadPage('materi')">
            <i class="fa-solid fa-book-open"></i>
            <span>Materi</span>
          </button>
          <button class="db-quick-btn" onclick="window.loadPage('jawaban')">
            <i class="fa-solid fa-clipboard-list"></i>
            <span>Jawaban</span>
          </button>
          <button class="db-quick-btn" onclick="window.loadPage('absensi')">
            <i class="fa-solid fa-location-dot"></i>
            <span>Absensi</span>
          </button>
          <button class="db-quick-btn" onclick="window.loadPage('jadwal')">
            <i class="fa-solid fa-calendar-days"></i>
            <span>Jadwal</span>
          </button>
          <button class="db-quick-btn" onclick="window.loadPage('export')">
            <i class="fa-solid fa-file-csv"></i>
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>`;
}

// ===== Soal CRUD (with bulk creation & multi-delete) =====
async function pageSoal() {
  const snap = await getDocs(collection(db,'questions'));
  const items = []; snap.forEach(d => items.push({ id:d.id, ...d.data() }));
  items.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  // group by set
  const groups = {};
  items.forEach(q => { const k = q.quizSet || 'Umum'; (groups[k] = groups[k] || []).push(q); });

  const groupRows = Object.entries(groups).map(([name, list]) => `
    <tr class="set-row" data-set="${escapeHtml(name)}">
      <td colspan="5" style="background:#f8faff;font-weight:700;color:var(--ink);font-family:var(--font-display)">
        <i class="fa-solid fa-folder-open" style="color:var(--blue);margin-right:8px"></i>${escapeHtml(name)}
        <span class="badge blue" style="margin-left:8px">${list.length} soal</span>
        <button class="btn btn-danger" style="float:right;padding:6px 12px;font-size:12px" onclick="window.delSet('${escapeAttr(name)}')"><i class="fa-solid fa-trash"></i> Hapus Set</button>
      </td>
    </tr>
    ${list.map((q,i)=>`<tr>
      <td style="width:50px;color:var(--muted);font-family:var(--font-mono)">${i+1}</td>
      <td style="max-width:480px">${escapeHtml(q.text)}</td>
      <td><span class="badge ${q.type==='mcq'?'blue':q.type==='table_checklist'||q.type==='tabel'||q.type==='table_fillin'?'gray':'gold'}">${q.type==='mcq'?'Pilihan Ganda':q.type==='table_checklist'||q.type==='tabel'?'Tbl Centang':q.type==='table_fillin'?'Tbl Isian':'Isian'}</span></td>
      <td>${q.type==='mcq'?`<small style="color:var(--muted)">${(q.options||[]).length} opsi · benar: ${String.fromCharCode(65+(q.correctIndex||0))}</small>`:q.type==='table_checklist'||q.type==='tabel'||q.type==='table_fillin'?`<small style="color:var(--muted)">${(q.tableConfig?.rows||[]).length} baris</small>`:'<small style="color:var(--muted)">—</small>'}</td>
      <td><div class="q-actions">
        <button class="btn btn-danger" onclick="window.delQ('${q.id}')"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    </tr>`).join('')}
  `).join('');

  content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3><i class="fa-solid fa-file-pen" style="color:var(--blue);margin-right:6px"></i>Kelola Soal · ${items.length} total</h3>
        <div class="actions">
          <button class="btn btn-primary" id="addBulk"><i class="fa-solid fa-layer-group"></i> Tambah Banyak Soal</button>
        </div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>#</th><th>Pertanyaan</th><th>Tipe</th><th>Detail</th><th>Aksi</th></tr></thead>
        <tbody>${groupRows || `<tr><td colspan="5" class="empty"><i class="fa-solid fa-inbox"></i><p>Belum ada soal. Klik "Tambah Banyak Soal" untuk mulai.</p></td></tr>`}</tbody>
      </table></div>
    </div>`;
  document.getElementById('addBulk').onclick = openBulkModal;
}

window.delQ = async (id) => {
  if (!confirm('Hapus soal ini?')) return;
  try { await deleteDoc(doc(db,'questions',id)); toast('Soal dihapus', { type:'success' }); loadPage('soal'); }
  catch (e) { toast(e.message, { type:'error' }); }
};

window.delSet = async (setName) => {
  if (!confirm(`Hapus SEMUA soal di set "${setName}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    const snap = await getDocs(query(collection(db,'questions'), where('quizSet','==',setName)));
    const ops = []; snap.forEach(d => ops.push(deleteDoc(doc(db,'questions',d.id))));
    await Promise.all(ops);
    toast(`Set "${setName}" dihapus (${ops.length} soal)`, { type:'success' });
    loadPage('soal');
  } catch(e) { toast(e.message, { type:'error' }); }
};

// ===== Bulk question creator =====
let bulkCounter = 0;
function bulkItemTemplate(idx, prefill={}) {
  const id = ++bulkCounter;
  const type = prefill.type || 'mcq';
  return `
    <div class="bulk-item" data-id="${id}">
      <div class="bi-head">
        <div class="bi-num">${idx+1}</div>
        <strong style="font-size:13.5px">Soal ${idx+1}</strong>
        <button class="bi-del" data-del="${id}"><i class="fa-solid fa-trash"></i> Hapus</button>
      </div>
      <div class="bi-row">
        <select data-k="type">
          <option value="mcq"${type==='mcq'?' selected':''}>Pilihan Ganda</option>
          <option value="text"${type==='text'?' selected':''}>Isian Singkat</option>
          <option value="table_checklist"${type==='table_checklist'?' selected':''}>Tabel Centang</option>
          <option value="table_fillin"${type==='table_fillin'?' selected':''}>Tabel Isian</option>
        </select>
        <textarea data-k="text" placeholder="Tulis pertanyaan...">${escapeHtml(prefill.text||'')}</textarea>
      </div>
      <div class="bulk-mcq" style="${type!=='mcq'?'display:none':''}">
        <textarea data-k="opts" placeholder="Pilihan A&#10;Pilihan B&#10;Pilihan C&#10;Pilihan D">${escapeHtml((prefill.options||[]).join('\n'))}</textarea>
        <div class="bi-row">
          <select data-k="cor">
            ${['A','B','C','D','E','F'].map((l,i)=>`<option value="${i}"${(prefill.correctIndex||0)===i?' selected':''}>Jawaban Benar: ${l}</option>`).join('')}
          </select>
          <div style="font-size:12px;color:var(--muted);align-self:center">Pisahkan tiap pilihan dengan baris baru.</div>
        </div>
      </div>
      <div class="bulk-table-checklist" style="${type!=='table_checklist'?'display:none':''}">
        <div style="margin-top:8px;display:flex;gap:10px">
          <div style="flex:1">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Kolom Centang (satu per baris):</label>
            <textarea data-checklist="cols" placeholder="Dengar&#10;Peduli&#10;Hargai&#10;..." style="width:100%;min-height:80px;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px"></textarea>
          </div>
          <div style="flex:1">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Baris Item (satu per baris):</label>
            <textarea data-checklist="rows" placeholder="Senam pagi&#10;Pengenalan OSIS&#10;Bakti sosial&#10;..." style="width:100%;min-height:80px;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px"></textarea>
          </div>
        </div>
        <div class="tbl-preview" style="margin-top:6px;font-size:12px;color:var(--muted)">Preview akan tampil di sini...</div>
        <div style="margin-top:6px;font-size:12px;color:var(--muted)">Siswa akan memberi <b>centang</b> pada setiap kolom untuk setiap item.</div>
      </div>
      <div class="bulk-table-fillin" style="${type!=='table_fillin'?'display:none':''}">
        <div style="margin-top:8px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Daftar Field (satu per baris):</label>
          <textarea data-fillin="rows" placeholder="Nama lengkap&#10;Kelas&#10;Cita-cita&#10;..." style="width:100%;min-height:60px;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px"></textarea>
        </div>
        <div class="tbl-preview" style="margin-top:6px;font-size:12px;color:var(--muted)">Preview akan tampil di sini...</div>
        <div style="margin-top:6px;font-size:12px;color:var(--muted)">Siswa akan <b>mengetik jawaban</b> pada setiap field.</div>
      </div>
    </div>`;
}

function openBulkModal() {
  modalBox.innerHTML = `
    <div class="modal-head"><h3><i class="fa-solid fa-layer-group"></i> Tambah Banyak Soal</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body" style="max-width:680px">
      <div class="bulk-toolbar">
        <label>Set Soal:</label>
        <input id="bSet" placeholder="Contoh: Pengenalan Sekolah" style="flex:1;min-width:160px">
        <label>Jumlah:</label>
        <input id="bCount" type="number" min="1" max="50" value="10" style="width:80px">
        <label>Tipe default:</label>
        <select id="bType"><option value="mcq">Pilihan Ganda</option><option value="text">Isian Singkat</option><option value="table_checklist">Tabel Centang</option><option value="table_fillin">Tabel Isian</option><option value="mix">Campuran</option></select>
        <button class="btn btn-outline" id="bGen"><i class="fa-solid fa-wand-magic-sparkles"></i> Buat Slot</button>
        <button class="btn btn-ghost" id="bAdd1"><i class="fa-solid fa-plus"></i> Tambah 1</button>
      </div>
      <div class="bulk-list" id="bList"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close="modal">Batal</button>
      <button class="btn btn-primary" id="bSave"><i class="fa-solid fa-save"></i> Simpan Semua</button>
    </div>`;
  showModal('modal');
  const list = document.getElementById('bList');

  const renumber = () => {
    list.querySelectorAll('.bulk-item').forEach((it, i) => {
      it.querySelector('.bi-num').textContent = i+1;
      it.querySelector('strong').textContent = 'Soal ' + (i+1);
    });
  };
  const wire = () => {
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (list.querySelectorAll('.bulk-item').length <= 1) return toast('Minimal 1 soal', {type:'warning'});
      b.closest('.bulk-item').remove(); renumber();
    });
    list.querySelectorAll('[data-k="type"]').forEach(s => s.onchange = (e) => {
      const item = e.target.closest('.bulk-item');
      const val = e.target.value;
      item.querySelector('.bulk-mcq').style.display = val==='mcq' ? '' : 'none';
      item.querySelector('.bulk-table-checklist').style.display = val==='table_checklist' ? '' : 'none';
      item.querySelector('.bulk-table-fillin').style.display = val==='table_fillin' ? '' : 'none';
      if (val==='table_checklist' || val==='table_fillin') setTimeout(() => updatePreview(item.querySelector(`[data-${val==='table_checklist'?'checklist':'fillin'}="rows"]`)), 50);
    });
    const updatePreview = (ta) => {
      if (!ta) return;
      const item = ta.closest('.bulk-item');
      const preview = item.querySelector('.tbl-preview');
      const checklistEl = item.querySelector('.bulk-table-checklist');
      const isChecklist = ta.matches('[data-checklist]') || (checklistEl && checklistEl.style.display !== 'none');
      const rows = isChecklist
        ? (item.querySelector('[data-checklist="rows"]')?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
        : (item.querySelector('[data-fillin="rows"]')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      const colsText = isChecklist ? (item.querySelector('[data-checklist="cols"]')?.value || '') : '';
      if (!rows.length) { preview.innerHTML = 'Preview akan tampil di sini...'; return; }
      let h = '<div class="table-wrap"><table class="tbl" style="font-size:12px;margin:0">';
      if (isChecklist) {
        const colHeaders = colsText.split('\n').map(s => s.trim()).filter(Boolean);
        const headers = colHeaders.length ? colHeaders : ['✔'];
        h += '<thead><tr><th style="width:30px">No</th><th>Item</th>' + headers.map(c => `<th style="text-align:center;width:50px">${escapeHtml(c)}</th>`).join('') + '</tr></thead><tbody>';
        h += rows.map((r,i) => '<tr><td>' + (i+1) + '</td><td>' + escapeHtml(r) + '</td>' + headers.map(() => '<td style="text-align:center"><input type="checkbox" disabled style="width:14px;height:14px;margin:0"></td>').join('') + '</tr>').join('');
      } else {
        h += '<thead><tr><th style="width:30px">No</th><th>Field</th><th>Jawaban</th></tr></thead><tbody>';
        h += rows.map((r,i) => `<tr><td>${i+1}</td><td>${escapeHtml(r)}</td><td><input type="text" disabled style="width:100%;padding:3px 5px;border:1px solid var(--line);border-radius:4px;font-size:11px" placeholder="..."></td></tr>`).join('');
      }
      h += '</tbody></table></div>';
      preview.innerHTML = h;
    };
    list.querySelectorAll('[data-checklist="rows"], [data-checklist="cols"], [data-fillin="rows"]').forEach(ta => {
      ta.oninput = () => updatePreview(ta);
      setTimeout(() => updatePreview(ta), 50);
    });
  };
  const generate = (n, defType) => {
    list.innerHTML = '';
    const types = ['mcq', 'text', 'table_checklist', 'table_fillin'];
    for (let i = 0; i < n; i++) {
      const t = defType === 'mix' ? types[i % 4] : defType;
      list.insertAdjacentHTML('beforeend', bulkItemTemplate(i, { type: t }));
    }
    wire();
  };
  generate(10, 'mcq');

  document.getElementById('bGen').onclick = () => {
    const n = Math.max(1, Math.min(50, +document.getElementById('bCount').value || 10));
    generate(n, document.getElementById('bType').value);
  };
  document.getElementById('bAdd1').onclick = () => {
    const idx = list.querySelectorAll('.bulk-item').length;
    const defType = document.getElementById('bType').value;
    const t = defType === 'mix' ? 'mcq' : defType;
    list.insertAdjacentHTML('beforeend', bulkItemTemplate(idx, { type: t }));
    wire();
  };
  document.getElementById('bSave').onclick = async () => {
    const setName = document.getElementById('bSet').value.trim();
    if (!setName) return toast('Nama set wajib diisi', {type:'warning'});
    const items = [];
    let invalid = 0;
    list.querySelectorAll('.bulk-item').forEach((it, idx) => {
      const type = it.querySelector('[data-k="type"]').value;
      const text = it.querySelector('[data-k="text"]').value.trim();
      if (!text) { invalid++; return; }
      const data = { quizSet:setName, type, text, order: idx, createdAt: serverTimestamp() };
      if (type === 'mcq') {
        const opts = it.querySelector('[data-k="opts"]').value.split('\n').map(s=>s.trim()).filter(Boolean);
        if (opts.length < 2) { invalid++; return; }
        data.options = opts;
        data.correctIndex = +it.querySelector('[data-k="cor"]').value;
        if (data.correctIndex >= opts.length) data.correctIndex = 0;
      } else if (type === 'table_checklist') {
        const rows = it.querySelector('[data-checklist="rows"]').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        if (!rows.length) { invalid++; return; }
        const cols = it.querySelector('[data-checklist="cols"]').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        const columns = cols.length ? cols.map(c => ({ header: c })) : [{ header: '✔' }];
        data.tableConfig = { columns, rows };
      } else if (type === 'table_fillin') {
        const rows = it.querySelector('[data-fillin="rows"]').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
        if (!rows.length) { invalid++; return; }
        data.tableConfig = { rows };
      }
      items.push(data);
    });
    if (!items.length) return toast('Tidak ada soal valid untuk disimpan', {type:'error'});
    const btn = document.getElementById('bSave');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan ' + items.length + ' soal...';
    try {
      await Promise.all(items.map(d => addDoc(collection(db,'questions'), d)));
      hideModal('modal');
      toast(`${items.length} soal disimpan${invalid?` (${invalid} dilewati karena kosong)`:''}`, {type:'success'});
      loadPage('soal');
    } catch(e) { toast(e.message, {type:'error'}); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-save"></i> Simpan Semua'; }
  };
}

function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(s){return String(s==null?'':s).replace(/'/g,"\\'").replace(/"/g,'&quot;');}

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
const DAY_ORDER = { Senin:0, Selasa:1, Rabu:2, Kamis:3, Jumat:4 };
const DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function daySortKey(dayStr) {
  const name = (dayStr||'').split(',')[0].trim();
  return DAY_ORDER[name] !== undefined ? DAY_ORDER[name] : 99;
}
function fmtDate(date) {
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

let scheduleItems = [];

function renderSchedule(items) {
  const groups = {};
  items.forEach(s => {
    const k = s.day || 'Lainnya';
    (groups[k] = groups[k] || []).push(s);
  });
  const sortedDays = Object.keys(groups).sort((a,b) => daySortKey(a) - daySortKey(b) || a.localeCompare(b));
  const total = items.length;
  let html = `<div class="panel"><div class="panel-head"><h3>Jadwal Kegiatan (${total})</h3><div class="actions"><button class="btn btn-primary" id="addS"><i class="fa-solid fa-plus"></i> Tambah</button></div></div></div>`;
  sortedDays.forEach(day => {
    const list = groups[day].sort((a,b) => (a.time||'').localeCompare(b.time||''));
    html += `
      <div class="panel" style="margin-top:8px">
        <div class="panel-head" style="border-bottom:2px solid var(--secondary)"><h4 style="margin:0;font-family:var(--font-display);color:var(--secondary)"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(day)}</h4></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th style="width:40px">No</th><th>Waktu</th><th>Kegiatan</th><th>Lokasi</th><th style="width:100px"></th></tr></thead>
          <tbody>${list.map((s,i) => `<tr><td style="color:var(--muted);font-family:var(--font-mono)">${i+1}</td><td>${escapeHtml(s.time||'')}</td><td>${escapeHtml(s.title||'')}</td><td>${escapeHtml(s.location||'-')}</td><td><div style="display:flex;gap:4px"><button class="btn btn-outline" onclick="window.editS('${s.id}')" title="Edit" style="padding:6px 10px;font-size:12px"><i class="fa-solid fa-pen"></i></button><button class="btn btn-danger" onclick="window.delS('${s.id}')" title="Hapus" style="padding:6px 10px;font-size:12px"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  });
  if (!sortedDays.length) html += `<div class="panel"><div class="empty"><i class="fa-solid fa-inbox"></i><p>Belum ada jadwal. Klik "Tambah" untuk mulai.</p></div></div>`;
  content.innerHTML = html;
  document.getElementById('addS').onclick = openAddModal;
}

async function pageSchedule() {
  scheduleItems = [];
  pageUnsubscribe = onSnapshot(collection(db, 'schedule'), (snap) => {
    scheduleItems = [];
    snap.forEach(d => scheduleItems.push({ id: d.id, ...d.data() }));
    renderSchedule(scheduleItems);
  }, (err) => {
    console.error('schedule snapshot error', err);
    renderError(err, () => loadPage('jadwal'));
  });
}

function openAddModal() {
  let rowCount = 0;
  const rowsEl = () => document.getElementById('sRows');
  const addRow = (time='', title='', location='') => {
    const i = rowCount++;
    const d = document.createElement('div');
    d.className = 's-row';
    d.id = 'sRow'+i;
    d.innerHTML = `
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <div class="field" style="flex:1;min-width:120px"><label>Waktu</label><div class="ctrl"><i class="fa-solid fa-clock"></i><input class="sT" placeholder="07.00 - 08.00" value="${time.replace(/"/g,'&quot;')}"></div></div>
        <div class="field" style="flex:2;min-width:180px"><label>Nama Kegiatan</label><div class="ctrl"><i class="fa-solid fa-bookmark"></i><input class="sN" value="${title.replace(/"/g,'&quot;')}"></div></div>
        <div class="field" style="flex:1;min-width:120px"><label>Lokasi</label><div class="ctrl"><i class="fa-solid fa-location-dot"></i><input class="sL" placeholder="Aula / R. Kelas" value="${location.replace(/"/g,'&quot;')}"></div></div>
        <button class="btn btn-danger" style="flex-shrink:0;margin-bottom:2px" onclick="this.closest('.s-row').remove()"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    rowsEl().appendChild(d);
  };
  const today = new Date();
  const dayOpts = Object.keys(DAY_ORDER).map(d => `<option value="${d}"${d==='Senin'?' selected':''}>${d}</option>`).join('');
  modalBox.innerHTML = `
    <div class="modal-head"><h3>Tambah Jadwal (Banyak)</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <div class="field"><label>Hari</label><div class="ctrl"><i class="fa-solid fa-calendar"></i><select id="sDay" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px">${dayOpts}</select></div></div>
      <div class="field"><label>Tanggal</label><div class="ctrl"><i class="fa-solid fa-calendar-check"></i><input type="date" id="sDate" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div></div>
      <div style="margin-top:12px"><label style="display:block;font-weight:600;margin-bottom:6px">Daftar Kegiatan</label>
      <div id="sRows"></div>
      <button class="btn btn-ghost" id="addRowBtn" style="width:100%"><i class="fa-solid fa-plus"></i> Tambah Baris</button></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close="modal">Batal</button><button class="btn btn-primary" id="ss">Simpan Semua</button></div>`;
  addRow();
  document.getElementById('addRowBtn').onclick = () => addRow();
  showModal('modal');
  document.getElementById('ss').onclick = async () => {
    const dayName = document.getElementById('sDay').value;
    const dateVal = document.getElementById('sDate').value;
    if (!dateVal) return toast('Tanggal wajib diisi', { type:'warning' });
    const d = new Date(dateVal + 'T00:00:00');
    const day = `${dayName}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const rowEls = rowsEl().querySelectorAll('.s-row');
    const batch = [];
    let hasData = false;
    rowEls.forEach(el => {
      const time = el.querySelector('.sT').value.trim();
      const title = el.querySelector('.sN').value.trim();
      const location = el.querySelector('.sL').value.trim();
      if (!title) return;
      hasData = true;
      batch.push({ day, time, title, location, createdAt: serverTimestamp() });
    });
    if (!hasData) return toast('Minimal 1 kegiatan harus diisi', { type:'warning' });
    try {
      for (const data of batch) await addDoc(collection(db, 'schedule'), data);
      hideModal('modal'); toast(`${batch.length} kegiatan disimpan`, { type:'success' });
    } catch(e) { toast(e.message, { type:'error' }); }
  };
}

window.editS = async (id) => {
  let item = scheduleItems.find(x => x.id === id);
  if (!item) {
    const snap = await getDoc(doc(db, 'schedule', id));
    if (!snap.exists()) return toast('Data tidak ditemukan', { type:'error' });
    item = { id: snap.id, ...snap.data() };
  }
  modalBox.innerHTML = `
    <div class="modal-head"><h3>Edit Jadwal</h3><button class="icon-btn" data-close="modal"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <div class="field"><label>Hari/Tanggal</label><div class="ctrl"><i class="fa-solid fa-calendar"></i><input id="eDay" value="${escapeAttr(item.day||'')}" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div></div>
      <div class="field"><label>Waktu</label><div class="ctrl"><i class="fa-solid fa-clock"></i><input id="eTime" value="${escapeAttr(item.time||'')}" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div></div>
      <div class="field"><label>Nama Kegiatan</label><div class="ctrl"><i class="fa-solid fa-bookmark"></i><input id="eTitle" value="${escapeAttr(item.title||'')}" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div></div>
      <div class="field"><label>Lokasi</label><div class="ctrl"><i class="fa-solid fa-location-dot"></i><input id="eLoc" value="${escapeAttr(item.location||'')}" style="flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px"></div></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close="modal">Batal</button><button class="btn btn-primary" id="saveEdit"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>`;
  showModal('modal');
  document.getElementById('saveEdit').onclick = async () => {
    const payload = {
      day: document.getElementById('eDay').value.trim(),
      time: document.getElementById('eTime').value.trim(),
      title: document.getElementById('eTitle').value.trim(),
      location: document.getElementById('eLoc').value.trim(),
      updatedAt: serverTimestamp()
    };
    if (!payload.day || !payload.time || !payload.title) return toast('Hari, waktu, dan kegiatan wajib diisi', { type:'warning' });
    try {
      await updateDoc(doc(db, 'schedule', id), payload);
      hideModal('modal'); toast('Jadwal diperbarui', { type:'success' });
    } catch(e) { toast(e.message, { type:'error' }); }
  };
};

window.delS = async (id) => {
  if(!confirm('Hapus jadwal ini?')) return;
  try { await deleteDoc(doc(db,'schedule',id)); toast('Dihapus',{type:'success'}); }
  catch(e) { toast(e.message,{type:'error'}); }
};

// ===== Jawaban + Penilaian =====
let questionsCache = null;

async function pageJawaban() {
  const qSnap = await getDocs(collection(db, 'questions'));
  questionsCache = [];
  qSnap.forEach(d => questionsCache.push({ id: d.id, ...d.data() }));
  const filter = `<select id="fGugus" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px"><option value="">Semua Gugus</option>${SCHOOL_CONFIG.groups.map(g=>`<option>${g}</option>`).join('')}</select>`;
  content.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>Jawaban Siswa <span id="jawabanCount">(0)</span></h3>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${filter}
          <button class="btn btn-danger" id="btnResetNilai" title="Hapus semua nilai & jawaban siswa (reset progres)"><i class="fa-solid fa-trash-can"></i> Hapus Semua Nilai</button>
        </div>
      </div>
      <div class="table-wrap"><table class="tbl" id="tblA">
        <thead><tr><th>Siswa</th><th>Gugus</th><th>Set</th><th>Pelanggaran</th><th>Nilai Akhir</th><th>Aksi</th></tr></thead>
        <tbody></tbody>
      </table></div>
    </div>`;
  document.getElementById('btnResetNilai').onclick = () => window.resetAllNilai();
  const items = [];
  const render = (filterG='') => {
    const tbody = content.querySelector('tbody');
    const list = items.filter(a => !filterG || a.gugus===filterG);
    const countEl = document.getElementById('jawabanCount');
    if (countEl) countEl.textContent = `(${items.length})`;
    tbody.innerHTML = list.map(a => `<tr>
      <td><strong>${a.name}</strong><br><small style="color:var(--muted)">${a.kelas||''}</small></td>
      <td><span class="badge blue">${a.gugus||'-'}</span></td>
      <td>${a.quizSet}</td>
      <td>${a.violations ? `<span class="badge red">${a.violations}</span>` : '<span class="badge green">0</span>'}</td>
      <td>${a.finalScore!=null?`<strong>${a.finalScore}</strong>`:'<span class="badge gold">Belum</span>'}</td>
      <td><button class="btn btn-outline" onclick="window.gradeModal('${a.id}')"><i class="fa-solid fa-pen"></i> Nilai</button></td>
    </tr>`).join('') || `<tr><td colspan="6" class="empty">Belum ada jawaban</td></tr>`;
  };
  pageUnsubscribe = onSnapshot(collection(db, 'answers'), (snap) => {
    snap.docChanges().forEach(change => {
      const data = { id: change.doc.id, ...change.doc.data() };
      if (change.type === 'added') {
        items.push(data);
      } else if (change.type === 'modified') {
        const idx = items.findIndex(x => x.id === change.doc.id);
        if (idx !== -1) items[idx] = data;
      } else if (change.type === 'removed') {
        const idx = items.findIndex(x => x.id === change.doc.id);
        if (idx !== -1) items.splice(idx, 1);
      }
    });
    const gugus = document.getElementById('fGugus')?.value || '';
    render(gugus);
  });
  document.getElementById('fGugus').onchange = (e) => render(e.target.value);
}

window.gradeModal = async (id) => {
  const snap = await getDoc(doc(db, 'answers', id));
  if (!snap.exists()) return toast('Data tidak ditemukan', { type: 'error' });
  const a = { id: snap.id, ...snap.data() };
  const qIds = Object.keys(a.answers || {});
  if (!qIds.length) return toast('Tidak ada jawaban untuk dinilai', { type: 'warning' });

  let totalPoints = 100;
  let perQuestion = totalPoints / qIds.length;

  const renderModal = () => {
    let qHtml = '';
    qIds.forEach((qId, i) => {
      const q = questionsCache ? questionsCache.find(x => x.id === qId) : null;
      const ans = a.answers[qId];
      qHtml += `<div style="padding:14px;margin-bottom:10px;background:var(--bg);border-radius:10px;border:1px solid var(--line)">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:8px">${i+1}. ${q ? q.text : '<em style="color:var(--muted)">Soal telah dihapus</em>'}</div>`;
      if (q && q.type === 'mcq' && q.options) {
        qHtml += `<div style="display:grid;gap:4px">${q.options.map((opt, oi) => {
          const selected = oi === ans;
          const isCorrectOpt = oi === q.correctIndex;
          let cls = 'padding:6px 10px;border-radius:6px;font-size:.85rem';
          if (selected && isCorrectOpt) cls += ';background:#d4edda;color:#155724;border:1px solid #c3e6cb';
          else if (selected) cls += ';background:#fff3cd;color:#856404;border:1px solid #ffeeba';
          else if (isCorrectOpt) cls += ';background:#e2f0d9;color:#2d5a1e;border:1px solid #c8e6b3';
          else cls += ';background:transparent;color:var(--muted)';
          const icon = selected ? (isCorrectOpt ? '✓' : '✗') : (isCorrectOpt ? '✓' : '');
          return `<div style="${cls}">${icon ? `<strong>${icon}</strong> ` : ''}${opt}</div>`;
        }).join('')}</div>`;
      } else if (q && (q.type === 'table_checklist' || q.type === 'tabel')) {
        const cfg = q.tableConfig || { columns: [{ header: '✔' }], rows: [] };
        const colDefs = cfg.columns || [{ header: '✔' }];
        const rows = cfg.rows || [];
        const studentAns = ans || {};
        qHtml += '<div class="table-wrap" style="margin-top:6px"><table class="tbl" style="font-size:12px">';
        qHtml += '<thead><tr><th style="width:30px">No</th><th>Item</th>' + colDefs.map(c => `<th style="text-align:center">${escapeHtml(c.header)}</th>`).join('') + '</tr></thead><tbody>';
        qHtml += rows.map((label, ri) => {
          return '<tr><td>' + (ri+1) + '</td><td>' + escapeHtml(label) + '</td>' +
            colDefs.map((c, ci) => {
              const checked = studentAns[ri]?.[ci] ? 'checked' : '';
              return `<td style="text-align:center"><input type="checkbox" disabled ${checked} style="width:16px;height:16px"></td>`;
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      } else if (q && q.type === 'table_fillin') {
        const cfg = q.tableConfig || { rows: [] };
        const rows = cfg.rows || [];
        const studentAns = ans || {};
        qHtml += '<div class="table-wrap" style="margin-top:6px"><table class="tbl" style="font-size:12px">';
        qHtml += '<thead><tr><th style="width:30px">No</th><th>Field</th><th>Jawaban</th></tr></thead><tbody>';
        qHtml += rows.map((label, ri) => {
          const val = studentAns[ri]?.[0] || '';
          return `<tr><td>${ri+1}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(val) || '<em style="color:var(--muted)">—</em>'}</td></tr>`;
        }).join('') + '</tbody></table></div>';
      } else if (ans != null && typeof ans === 'object' && !Array.isArray(ans)) {
        const keys = Object.keys(ans);
        if (keys.length && keys.every(k => !isNaN(+k))) {
          let maxCol = 0;
          keys.forEach(k => { const inner = ans[k]; if (typeof inner === 'object') { Object.keys(inner).forEach(c => { if (+c > maxCol) maxCol = +c; }); } });
          qHtml += '<div class="table-wrap" style="margin-top:6px"><table class="tbl" style="font-size:12px"><thead><tr><th style="width:30px">#</th>';
          for (let c = 0; c <= maxCol; c++) qHtml += `<th style="text-align:center">Kolom ${c+1}</th>`;
          qHtml += '</tr></thead><tbody>';
          qHtml += keys.sort((a,b)=>+a-+b).map(k => {
            const inner = ans[k] || {};
            let cls = 'padding:4px 8px;font-size:.85rem';
            return '<tr><td style="color:var(--muted);font-family:var(--font-mono);text-align:center">' + (+k+1) + '</td>' +
              Array.from({length: maxCol+1}, (_, ci) => {
                const v = inner[ci];
                if (typeof v === 'boolean') return `<td style="text-align:center"><input type="checkbox" disabled ${v?'checked':''} style="width:16px;height:16px"></td>`;
                return `<td style="${cls}">${escapeHtml(String(v ?? '')) || '<em style="color:var(--muted)">—</em>'}</td>`;
              }).join('') + '</tr>';
          }).join('');
          qHtml += '</tbody></table></div>';
        } else {
          qHtml += `<div style="padding:8px 12px;background:var(--white);border-radius:6px;font-size:.85rem;border:1px solid var(--line)"><code>${escapeHtml(JSON.stringify(ans))}</code></div>`;
        }
      } else {
        qHtml += `<div style="padding:8px 12px;background:var(--white);border-radius:6px;font-size:.85rem;border:1px solid var(--line)">${ans != null ? escapeHtml(String(ans)) : '<em style="color:var(--muted)">Tidak dijawab</em>'}</div>`;
      }
      qHtml += `</div>`;
    });

    const body = `
      <div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line)">
        <strong>${a.name}</strong> — ${a.gugus||'-'}<br>
        <span style="color:var(--muted)">Set: ${a.quizSet} | ${qIds.length} soal</span>
      </div>
      <div style="max-height:50vh;overflow-y:auto;margin-bottom:16px">${qHtml}</div>
      <div style="padding-top:14px;border-top:2px solid var(--line);display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="font-weight:600">Nilai (0-100):</label>
          <input type="number" id="manualScore" min="0" max="100" value="0" style="width:80px;padding:8px 12px;border:2px solid var(--line);border-radius:8px;font-size:1rem;text-align:center">
          <span style="font-size:.85rem;color:var(--muted)">/ 100</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-primary" id="btnSaveGrade"><i class="fa-solid fa-floppy-disk"></i> Simpan Nilai</button>
          <button class="btn btn-outline" onclick="hideModal('modal')">Batal</button>
        </div>
      </div>`;

    modalBox.innerHTML = `<div class="modal-head"><h3>Koreksi Jawaban</h3><button class="modal-close" onclick="hideModal('modal')">&times;</button></div><div class="modal-body">${body}</div>`;
    showModal('modal');

    document.getElementById('manualScore').oninput = function() {
      const v = +this.value;
      if (isNaN(v) || v < 0) { this.value = 0; return; }
      if (v > 100) this.value = 100;
    };

    document.getElementById('btnSaveGrade').onclick = async () => {
      const manualInput = document.getElementById('manualScore');
      const finalScore = Math.min(100, Math.max(0, Math.round(+manualInput.value || 0)));
      document.getElementById('btnSaveGrade').disabled = true;
      document.getElementById('btnSaveGrade').innerHTML = '<span class="spinner"></span> Menyimpan...';
      try {
        await updateDoc(doc(db, 'answers', id), {
          finalScore,
          gradedAt: serverTimestamp()
        });
        hideModal('modal');
        toast('Nilai berhasil disimpan', { type: 'success' });
      } catch (e) {
        toast('Gagal menyimpan: ' + e.message, { type: 'error' });
        document.getElementById('btnSaveGrade').disabled = false;
        document.getElementById('btnSaveGrade').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Nilai';
      }
    };
  };

  renderModal();
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
      <div class="panel-head"><h3>Riwayat Pelanggaran (terbaru)</h3>
        <div class="actions"><select id="fGugusAudit" style="padding:8px 12px;border:1px solid var(--line);border-radius:10px"><option value="">Semua Gugus</option>${SCHOOL_CONFIG.groups.map(g=>`<option>${g}</option>`).join('')}</select></div>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Waktu</th><th>Siswa</th><th>Gugus</th><th>Set Soal</th><th>Tipe</th><th>Pesan</th><th>Penalti</th></tr></thead>
        <tbody id="tbodyAudit"></tbody>
      </table></div>
    </div>`;

  window.__auditItems = items;

  const renderAudit = (filterG='') => {
    const tbody = document.getElementById('tbodyAudit');
    const list = filterG ? items.filter(l => l.gugus===filterG) : items;
    tbody.innerHTML = list.slice(0,200).map(l => {
      const t = l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000).toLocaleString('id-ID') : '-';
      return `<tr><td><small>${t}</small></td><td><strong>${l.name||'-'}</strong></td><td><span class="badge blue">${l.gugus||'-'}</span></td><td>${l.quizSet||'-'}</td><td><code style="font-size:11px">${l.type}</code></td><td>${l.message||''}</td><td><span class="badge red">-${l.penalty||0}</span></td></tr>`;
    }).join('') || `<tr><td colspan="7" class="empty">Belum ada log</td></tr>`;
  };
  renderAudit();
  const sel = document.getElementById('fGugusAudit');
  if (sel) sel.onchange = e => renderAudit(e.target.value);

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
    const rows = [['Nama','NIS','Kelas','Gugus','Set Soal','Nilai Akhir','Pelanggaran']];
    snap.forEach(d => {
      const a = d.data();
      if (gugus && a.gugus !== gugus) return;
      if (a.finalScore == null) return;
      rows.push([a.name, a.nis||'', a.kelas||'', a.gugus||'', a.quizSet||'', a.finalScore, a.violations||0]);
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
