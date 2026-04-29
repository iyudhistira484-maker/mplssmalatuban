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

  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-back')) e.target.classList.remove('show');
    if (e.target.dataset && e.target.dataset.close) hideModal(e.target.dataset.close);
    if (e.target.closest && e.target.closest('.sb-toggle')) {
      var sb = document.querySelector('.sidebar'); if (sb) sb.classList.toggle('open');
    }
  });

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
  function boot() { initReveal(); initNav(); initCounters(); initYear(); }
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
