(function(){
  if (window.__FX_LOADED__) return; window.__FX_LOADED__ = true;

  // ============== Animated background (tetap) ==============
  if (!document.querySelector('.fx-bg')) {
    const bg = document.createElement('div');
    bg.className = 'fx-bg';
    bg.innerHTML = '<div class="aurora"></div><div class="orb"></div><div class="orb2"></div><div class="orb3"></div><div class="orb4"></div>';
    document.body.prepend(bg);
  }

  // ============== SPLASH MOUSE — super simple, hemat HP ==============
  // Hanya muncul saat ada gerakan / klik. Tidak ada loop saat idle.
  const canvas = document.createElement('canvas');
  canvas.id = 'fx-particles';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let W=0, H=0;
  function resize(){
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth+'px';
    canvas.style.height = innerHeight+'px';
  }
  resize(); addEventListener('resize', resize, {passive:true});

  const splashes = [];
  const MAX = 14; // batas keras biar ga lag
  let hue = Math.floor(Math.random()*360);
  let rafId = 0;
  let running = false;

  function spawn(x, y, big){
    if (splashes.length >= MAX) splashes.shift();
    splashes.push({
      x: x * DPR, y: y * DPR,
      r: 0,
      maxR: (big ? 36 : 22) * DPR,
      life: 1,
      hue: hue
    });
    hue = (hue + 24) % 360;
    if (!running) { running = true; rafId = requestAnimationFrame(tick); }
  }

  function tick(){
    ctx.clearRect(0, 0, W, H);
    for (let i = splashes.length - 1; i >= 0; i--){
      const s = splashes[i];
      s.life -= 0.05;          // hilang ~0.3s
      s.r += (s.maxR - s.r) * 0.25; // melebar cepat
      if (s.life <= 0){ splashes.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.strokeStyle = `hsla(${s.hue}, 95%, 60%, ${s.life})`;
      ctx.lineWidth = 2 * DPR;
      ctx.stroke();
      // dot kecil di tengah
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5 * DPR * s.life, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${s.hue}, 95%, 65%, ${s.life})`;
      ctx.fill();
    }
    if (splashes.length){
      rafId = requestAnimationFrame(tick);
    } else {
      running = false; // STOP loop saat idle → 0% CPU
      ctx.clearRect(0, 0, W, H);
    }
  }

  // Throttle: maksimal 1 splash per ~70ms saat geser
  let lastT = 0;
  function onMove(e){
    const now = performance.now();
    if (now - lastT < 70) return;
    lastT = now;
    const t = e.touches ? e.touches[0] : e; if (!t) return;
    spawn(t.clientX, t.clientY, false);
  }
  function onClick(e){
    spawn(e.clientX, e.clientY, true);
  }

  addEventListener('mousemove', onMove, {passive:true});
  addEventListener('touchmove', onMove, {passive:true});
  addEventListener('pointerdown', onClick, {passive:true});
  addEventListener('click', onClick, {passive:true});

  // ============== Scroll reveal ==============
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:.08});
  function scan(){
    document.querySelectorAll('section, .card, .att-opt, .auth-form, .gps-card, .panel, .kpi, .content > *').forEach(el=>{
      if(!el.classList.contains('fx-reveal')){ el.classList.add('fx-reveal'); io.observe(el); }
    });
  }
  if (document.readyState==='loading') addEventListener('DOMContentLoaded', scan); else scan();
  new MutationObserver(()=>scan()).observe(document.body, {childList:true, subtree:true});
})();
