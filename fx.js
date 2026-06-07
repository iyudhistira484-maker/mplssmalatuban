/* Simple, clean FX — no cursor splash, no drag/touch effects.
   Keep only: subtle animated background + scroll reveal. */
(function(){
  if (window.__FX_LOADED__) return; window.__FX_LOADED__ = true;

  // Subtle animated background (CSS-driven via fx-bg)
  if (!document.querySelector('.fx-bg')) {
    const bg = document.createElement('div');
    bg.className = 'fx-bg';
    bg.innerHTML = '<div class="aurora"></div><div class="orb"></div><div class="orb2"></div>';
    document.body.prepend(bg);
  }

  // Scroll reveal — gentle, one-time
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:.08});
  function scan(){
    document.querySelectorAll('section, .card, .att-opt, .auth-form, .gps-card, .panel, .kpi, .nusantara-card').forEach(el=>{
      if(!el.classList.contains('fx-reveal')){ el.classList.add('fx-reveal'); io.observe(el); }
    });
  }
  if (document.readyState==='loading') addEventListener('DOMContentLoaded', scan); else scan();
})();
