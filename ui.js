// ============================================================
// UI Utilities — Loader, Toast, Reveal, Nav, Modal
// Loaded as classic script (NOT module) — exposes globals on window.
// ============================================================
(function () {
  'use strict';

  // ---------- Loader (failsafe: ALWAYS hides) ----------
  function hideLoader() {
    var l = document.getElementById('loader');
    if (l && !l.classList.contains('hide')) l.classList.add('hide');
  }
  // Multiple triggers so loader never gets stuck
  window.addEventListener('load', function () { setTimeout(hideLoader, 350); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(hideLoader, 1500); });
  setTimeout(hideLoader, 4000); // hard failsafe — even if scripts error
  window.addEventListener('error', function () { setTimeout(hideLoader, 200); });

  // ---------- Reveal on scroll ----------
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  // ---------- Navbar scroll + mobile toggle ----------
  function initNav() {
    var nav = document.getElementById('nav');
    if (nav) {
      window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 8);
      });
    }
    var navToggle = document.getElementById('navToggle');
    var navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', function () { navMenu.classList.toggle('show'); });
      navMenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { navMenu.classList.remove('show'); });
      });
    }
  }

  // ---------- Toast ----------
  function toast(message, opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var title = opts.title || '';
    var duration = opts.duration || 3500;
    var root = document.getElementById('toast-root');
    if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
    var icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    var titles = { success: 'Berhasil', error: 'Gagal', warning: 'Perhatian', info: 'Informasi' };
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML =
      '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i>' +
      '<div><strong>' + (title || titles[type]) + '</strong><p>' + message + '</p></div>';
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      el.addEventListener('animationend', function () { el.remove(); }, { once: true });
    }, duration);
  }

  // ---------- Modal helpers ----------
  function showModal(id) { var m = document.getElementById(id); if (m) m.classList.add('show'); }
  function hideModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('show'); }

  // ---------- Sidebar backdrop (mobile) ----------
  function createSidebarBackdrop() {
    var existing = document.getElementById('sbBackdrop');
    if (existing) return existing;
    var backdrop = document.createElement('div');
    backdrop.id = 'sbBackdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function () {
      var sb = document.querySelector('.sidebar');
      if (sb) sb.classList.remove('open');
      backdrop.classList.remove('show');
      document.body.classList.remove('sb-locked');
    });
    return backdrop;
  }

  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-back')) e.target.classList.remove('show');
    if (e.target.dataset && e.target.dataset.close) hideModal(e.target.dataset.close);
    var togBtn = e.target.closest && e.target.closest('.sb-toggle');
    if (togBtn) {
      var sb = document.querySelector('.sidebar');
      if (sb) {
        var bp = createSidebarBackdrop();
        sb.classList.toggle('open');
        var isOpen = sb.classList.contains('open');
        bp.classList.toggle('show', isOpen);
        document.body.classList.toggle('sb-locked', isOpen);
      }
    }
    // close on link click inside sidebar (mobile)
    var sbLink = e.target.closest && e.target.closest('.sidebar .sb-link');
    if (sbLink && window.matchMedia('(max-width: 860px)').matches) {
      var sb2 = document.querySelector('.sidebar');
      if (sb2) sb2.classList.remove('open');
      var bp2 = document.getElementById('sbBackdrop');
      if (bp2) bp2.classList.remove('show');
      document.body.classList.remove('sb-locked');
    }
  });

  // ---------- Mobile Bottom Nav ----------
  function initBottomNav() {
    var nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    var backdrop = document.getElementById('mbnBackdrop');
    var sheet = document.getElementById('mbnSheet');
    var moreBtn = document.getElementById('mbnMore');

    function closeSheet() {
      if (sheet) sheet.classList.remove('show');
      if (backdrop) backdrop.classList.remove('show');
    }
    function openSheet() {
      if (sheet) sheet.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
    }
    function setActive(page) {
      nav.querySelectorAll('.mbn-item[data-page]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.page === page);
      });
      var sheetPages = ['jadwal','kegiatan','absensi','audit','rating','export','notif','nilai','info','profil'];
      if (sheetPages.indexOf(page) !== -1 && moreBtn) {
        nav.querySelectorAll('.mbn-item').forEach(function(b){ b.classList.remove('active'); });
        moreBtn.classList.add('active');
      }
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', function() { openSheet(); });
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeSheet);
    }

    // Bottom nav item clicks
    nav.querySelectorAll('.mbn-item[data-page]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var page = btn.dataset.page;
        setActive(page);
        closeSheet();
        window.addEventListener('_mbnReady', function cb() {
          window.removeEventListener('_mbnReady', cb);
          if (window.loadPage) window.loadPage(page);
        });
        if (window.loadPage) window.loadPage(page);
      });
    });

    // Sheet item clicks
    if (sheet) {
      sheet.querySelectorAll('.mbn-sheet-item[data-page]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var page = btn.dataset.page;
          closeSheet();
          setActive(page);
          if (window.loadPage) window.loadPage(page);
        });
      });
    }

    // Expose sync helper
    window.mbnSetActive = setActive;

    // Support topbar bell button → notif page (student)
    var bellBtn = document.getElementById('topBellBtn');
    if (bellBtn) {
      bellBtn.addEventListener('click', function() {
        closeSheet();
        setActive('notif');
        if (window.loadPage) window.loadPage('notif');
      });
    }
  }

  // ---------- Button loading helper ----------
  function btnLoading(btn, loading, text) {
    if (!btn) return;
    if (loading) {
      btn.dataset.original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + (text || 'Memproses...');
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.original || text || 'Submit';
    }
  }

  // ---------- Counter animation (for landing stats) ----------
  function initCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;
    var animate = function (el) {
      var target = +el.dataset.count;
      var cur = 0; var step = Math.max(1, Math.ceil(target / 60));
      var t = setInterval(function () {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur;
      }, 24);
    };
    if (!('IntersectionObserver' in window)) { counters.forEach(animate); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
      });
    });
    counters.forEach(function (c) { io.observe(c); });
  }

  // ---------- Year auto-fill ----------
  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  // ---------- Boot ----------
  function boot() { initReveal(); initNav(); initCounters(); initYear(); initBottomNav(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  // Expose globals
  window.toast = toast;
  window.showModal = showModal;
  window.hideModal = hideModal;
  window.btnLoading = btnLoading;
  window.MPLSUI = { toast: toast, showModal: showModal, hideModal: hideModal, btnLoading: btnLoading, hideLoader: hideLoader };
})();
