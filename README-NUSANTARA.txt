═══════════════════════════════════════════════════════
  PORTAL MPLS SMAN 5 TUBAN — NUSANTARA REDESIGN PACK
═══════════════════════════════════════════════════════

CARA PAKAI:
1. Backup folder asli kamu dulu.
2. Salin/replace SEMUA file di paket ini ke folder project kamu.
3. Refresh browser dengan hard-reload (Ctrl+F5 / Cmd+Shift+R)
   untuk membuang cache CSS lama.

FILE YANG DIGANTI:
- style.css        → Design system Nusantara penuh (token, komponen, dashboard, mobile)
- fx.css           → Background aurora & orb dengan palet merah-emas-hijau
- polish-v2.css    → Override netralisasi token biru lama
- login.html       → Auth-side Nusantara (struktur & form id dipertahankan)
- register.html    → Auth-side Nusantara
- admin-login.html → Auth-side gelap khusus admin
- about.html       → Font Nusantara
- developer.html   → Font Nusantara
- access-denied.html → Font Nusantara

YANG TIDAK DIUBAH (sesuai permintaan):
- index.html (landing page tetap)
- auth.js, firebase-config.js, admin.js, student.js,
  attendance-window.js, ui.js, main.js, fx.js
- Semua class, id, name pada form, button, dan elemen JS.

CATATAN:
- Semua selektor JS (#formLogin, #btnLogin, #formReg, #btnSubmit,
  #formAdmin, #toast-root, #loader, .reveal, .nav-toggle, dll)
  TIDAK BERUBAH — Firebase, animasi reveal, toast, hamburger menu,
  dan counter angka tetap berjalan normal.
- Jika fx.js mau warnanya ikut Nusantara, ganti di fx.js:
    const NUSANTARA_HUES = [10, 15, 35, 40, 90, 200];
    hue = NUSANTARA_HUES[Math.floor(Math.random() * NUSANTARA_HUES.length)];
  (opsional — tidak wajib karena fx.js tidak disertakan di paket ini.)

═══════════════════════════════════════════════════════
