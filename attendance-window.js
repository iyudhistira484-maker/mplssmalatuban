// ============================================================
// Attendance Window Control (TAMBAHAN — tidak mengubah kode lama)
// - Absensi dibuka jam 06:45
// - Absensi ditutup jam 15:30
// - Reset harian otomatis sudah ditangani oleh dokumen
//   attendance/{uid}_{YYYY-MM-DD} di attendance.html
// - File ini hanya MEMBLOKIR UI absensi di luar jam buka/tutup
// ============================================================
(function () {
  const OPEN_HOUR = 6,  OPEN_MIN  = 45;   // 06:45
  const CLOSE_HOUR = 15, CLOSE_MIN = 30;  // 15:30

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function fmt(h, m) {
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function status() {
    const now = nowMinutes();
    const open = OPEN_HOUR * 60 + OPEN_MIN;
    const close = CLOSE_HOUR * 60 + CLOSE_MIN;
    if (now < open)  return { state: 'before', msg: 'Absensi belum dibuka. Buka jam ' + fmt(OPEN_HOUR, OPEN_MIN) + '.' };
    if (now >= close) return { state: 'after',  msg: 'Absensi sudah ditutup pukul ' + fmt(CLOSE_HOUR, CLOSE_MIN) + '. Silakan kembali besok.' };
    return { state: 'open', msg: 'Absensi dibuka (' + fmt(OPEN_HOUR, OPEN_MIN) + ' – ' + fmt(CLOSE_HOUR, CLOSE_MIN) + ').' };
  }

  // Inject style sekali untuk banner modern
  function injectBannerStyle() {
    if (document.getElementById('attWindowBarStyle')) return;
    const css = `
    #attWindowBar{
      position:relative;margin:18px 0;padding:18px 18px 18px 64px;border-radius:18px;
      font-size:14px;font-weight:600;text-align:left;line-height:1.45;
      backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
      box-shadow:0 10px 30px -12px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.05);
      overflow:hidden;letter-spacing:.1px;
      animation:attBarIn .5s cubic-bezier(.2,.7,.2,1) both;
    }
    #attWindowBar::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:5px;border-radius:18px 0 0 18px;
    }
    #attWindowBar .att-ico{
      position:absolute;left:14px;top:50%;transform:translateY(-50%);
      width:38px;height:38px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;color:#fff;
      box-shadow:0 6px 14px -4px rgba(0,0,0,.25);
    }
    #attWindowBar .att-ico::after{
      content:"";position:absolute;inset:-6px;border-radius:50%;
      border:2px solid currentColor;opacity:.25;animation:attPulse 2s ease-out infinite;
    }
    #attWindowBar .att-title{display:block;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;opacity:.75;margin-bottom:2px;}
    #attWindowBar .att-msg{display:block;font-size:14.5px;font-weight:700;}
    #attWindowBar .att-time{
      display:inline-block;margin-left:6px;padding:2px 10px;border-radius:999px;
      font-variant-numeric:tabular-nums;font-weight:800;font-size:13.5px;
      background:rgba(255,255,255,.65);box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);
    }
    #attWindowBar.att-amber{background:linear-gradient(135deg,#fff8e1 0%,#fff3cd 60%,#ffe9a8 100%);color:#7a5300;}
    #attWindowBar.att-amber::before{background:linear-gradient(180deg,#f5b740,#e08a00);}
    #attWindowBar.att-amber .att-ico{background:linear-gradient(135deg,#f5b740,#e08a00);color:#fff;}
    #attWindowBar.att-green{background:linear-gradient(135deg,#ecfdf3 0%,#d6f5e1 60%,#bdedce 100%);color:#0a6b2c;}
    #attWindowBar.att-green::before{background:linear-gradient(180deg,#22c55e,#0a8a3a);}
    #attWindowBar.att-green .att-ico{background:linear-gradient(135deg,#22c55e,#0a8a3a);}
    @keyframes attBarIn{from{opacity:0;transform:translateY(-6px) scale(.98);}to{opacity:1;transform:none;}}
    @keyframes attPulse{0%{transform:scale(.85);opacity:.5}100%{transform:scale(1.45);opacity:0}}
    @media (max-width:420px){
      #attWindowBar{padding:16px 14px 16px 58px;border-radius:16px;}
      #attWindowBar .att-ico{width:34px;height:34px;left:12px;font-size:15px;}
      #attWindowBar .att-msg{font-size:13.5px;}
    }
    `;
    const s = document.createElement('style');
    s.id = 'attWindowBarStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Format pesan: highlight jam (HH:MM) dengan chip
  function decorateMsg(msg) {
    return msg.replace(/(\d{2}:\d{2})/g, '<span class="att-time">$1</span>');
  }

  function showBanner(state, rawMsg) {
    injectBannerStyle();
    let bar = document.getElementById('attWindowBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'attWindowBar';
      const card = document.querySelector('.gps-card');
      if (card) card.insertBefore(bar, card.children[2] || null);
      else document.body.prepend(bar);
    }
    let icon, title, cls;
    if (state === 'open') {
      cls = 'att-green'; icon = 'fa-door-open'; title = 'Absensi Dibuka';
    } else if (state === 'after') {
      cls = 'att-amber'; icon = 'fa-moon'; title = 'Absensi Ditutup';
    } else {
      cls = 'att-amber'; icon = 'fa-hourglass-half'; title = 'Belum Dibuka';
    }
    bar.className = cls;
    bar.innerHTML =
      '<span class="att-ico"><i class="fa-solid ' + icon + '"></i></span>' +
      '<span class="att-title">' + title + '</span>' +
      '<span class="att-msg">' + decorateMsg(rawMsg) + '</span>';
  }

  function lockUI(reason) {
    // Disable semua tombol aksi absensi
    const ids = ['btnGps', 'btnCam', 'btnCapture', 'btnRetake', 'btnSubmitFace'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = true;
        el.style.opacity = '0.55';
        el.style.cursor = 'not-allowed';
        el.title = reason;
      }
    });
    // Nonaktifkan pilihan status (hadir/izin/sakit)
    document.querySelectorAll('.att-opt').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.6';
    });
    // Nonaktifkan textarea alasan
    const r = document.getElementById('reason');
    if (r) r.disabled = true;
  }

  function unlockUI() {
    const ids = ['btnGps', 'btnCam'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = false;
        el.style.opacity = '';
        el.style.cursor = '';
        el.title = '';
      }
    });
    document.querySelectorAll('.att-opt').forEach(el => {
      el.style.pointerEvents = '';
      el.style.opacity = '';
    });
    const r = document.getElementById('reason');
    if (r) r.disabled = false;
  }

  function apply() {
    const s = status();
    if (s.state === 'open') {
      showBanner('open', s.msg);
      unlockUI();
    } else {
      showBanner(s.state, s.msg);
      lockUI(s.msg);
    }
  }

  function start() {
    apply();
    // Periksa setiap 30 detik supaya UI berubah otomatis saat lewat jam buka/tutup
    setInterval(apply, 30 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
