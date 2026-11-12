(function(){
  'use strict';

  /* ── THEME ── */
  var html = document.documentElement, S = 'sr-v15';
  function setTheme(t){ html.setAttribute('data-theme',t); try{localStorage.setItem(S,t)}catch(e){} }
  function getTheme(){
    try{ var s=localStorage.getItem(S); if(s==='dark'||s==='light') return s; }catch(e){}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }
  setTheme(getTheme());

  /* ── SUBSCRIBE via Ghost Members API directly ──────────────────────────
     We call /members/api/send-magic-link/ ourselves instead of relying on
     Ghost Portal's unreliable custom events. Ghost returns 201 on success.
     The user gets a confirmation email with a magic link — same flow,
     fully working.
  ─────────────────────────────────────────────────────────────────────── */
  function handleSubscribeForm(form) {
    if(form._srWired) return;
    form._srWired = true;

    var wrap = form.parentElement;
    var input = form.querySelector('input[type="email"]');
    var btn   = form.querySelector('.sub-btn');
    var lb    = form.querySelector('.sub-label');
    var ld    = form.querySelector('.sub-loading');
    var ok    = wrap && wrap.querySelector('.sub-success');
    var er    = wrap && wrap.querySelector('.sub-error');

    form.addEventListener('submit', function(e) {
      e.preventDefault();    /* We handle submission ourselves */
      e.stopPropagation();

      var email = input ? input.value.trim() : '';
      if(!email) return;

      /* Loading state */
      if(btn) btn.disabled = true;
      if(lb)  lb.hidden    = true;
      if(ld)  ld.hidden    = false;
      if(er)  er.hidden    = true;

      /* Step 1: fetch integrity token (required by Ghost since early 2025) */
      fetch('/members/api/integrity-token/', { method: 'GET' })
      .then(function(r) {
        if(!r.ok) throw new Error('token_failed');
        return r.text();
      })
      .then(function(token) {
        /* Step 2: send magic link with token */
        return fetch('/members/api/send-magic-link/', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email:          email,
            emailType:      'subscribe',
            labels:         [],
            integrityToken: token
          })
        });
      })
      .then(function(res) {
        if(res.status === 201 || res.ok) {
          form.style.display = 'none';
          if(ok) ok.hidden = false;
          playPostbox(wrap);
        } else {
          return res.json().then(function(data) {
            throw new Error((data && data.errors && data.errors[0] && data.errors[0].message) || 'failed');
          });
        }
      })
      .catch(function() {
        if(btn) btn.disabled = false;
        if(lb)  lb.hidden    = false;
        if(ld)  ld.hidden    = true;
        if(er)  { er.hidden  = false; setTimeout(function(){ er.hidden = true; }, 6000); }
      });
    }, false);
  }

  function initForms() {
    document.querySelectorAll('[data-members-form="subscribe"]').forEach(handleSubscribeForm);
  }

  /* ── HEADER: Bengaluru time + weather ── */
  function liveMetaTargets() {
    return [document.getElementById('hdrMetaText')].filter(Boolean);
  }
  function updateLiveMeta() {
    var targets = liveMetaTargets();
    if(!targets.length) return;
    var now = new Date();
    var t = now.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true});
    var setText = function(text){ targets.forEach(function(el){ el.textContent = text; }); };
    setText(t + ' IST');
    fetch('https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current_weather=true&temperature_unit=celsius')
      .then(function(r){ return r.json(); })
      .then(function(d){ if(d&&d.current_weather) setText(t+' IST · '+Math.round(d.current_weather.temperature)+'°C'); })
      .catch(function(){});
  }

  document.addEventListener('DOMContentLoaded', function(){

    /* Dark mode */
    var btn = document.getElementById('themeToggle');
    if(btn) btn.addEventListener('click', function(){ setTheme(html.getAttribute('data-theme')==='dark'?'light':'dark'); });
    if(window.matchMedia) {
      window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function(e){
        try{ if(!localStorage.getItem(S)) setTheme(e.matches?'dark':'light'); }catch(x){}
      });
    }

    /* Subscribe forms */
    initForms();
    setTimeout(initForms, 800);

    /* Copy post link */
    document.querySelectorAll('.copy-link-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(function(){
          btn.classList.add('copied');
          setTimeout(function(){ btn.classList.remove('copied'); }, 1600);
        }).catch(function(){});
      });
    });

    /* Active nav + sliding highlight */
    initNavPill();
    initKeywords();
    initTimeline();
    initPostbox();


    /* Open all external links in a new tab */
    document.querySelectorAll('a[href]').forEach(function(a){
      var href = a.getAttribute('href');
      if(!href) return;
      /* Skip: internal links, anchors, mailto, tel */
      if(href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      /* Skip: same hostname */
      try{
        var url = new URL(href, window.location.href);
        if(url.hostname === window.location.hostname) return;
      }catch(e){ return; }
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener noreferrer');
    });

    /* Header time + weather */
    updateLiveMeta();
    setInterval(function(){
      var targets = liveMetaTargets();
      if(!targets.length) return;
      var now = new Date();
      var t = now.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true});
      var cur = targets[0].textContent; var deg = cur.match(/·\s*\d+°C/);
      var text = deg ? t+' IST '+deg[0] : t+' IST';
      targets.forEach(function(el){ el.textContent = text; });
    }, 60000);

  });

  /* ── SUBSCRIBE POSTBOX · a letter drops into the 3D postbox ──────────────
     Plays on hover (CSS), on tap, and once more after a successful sign-up.
  ─────────────────────────────────────────────────────────────────────── */
  function playPostbox(root){
    var pb = root && root.querySelector ? root.querySelector('.nl-post') : null;
    if(!pb) return;
    pb.classList.remove('is-play'); void pb.offsetWidth; pb.classList.add('is-play');
    clearTimeout(pb._t); pb._t = setTimeout(function(){ pb.classList.remove('is-play'); }, 1300);
  }
  function initPostbox(){
    document.querySelectorAll('.nl-card .nl-post').forEach(function(pb){
      pb.addEventListener('click', function(){ playPostbox(pb.parentElement); });
    });
  }

  /* ── WRITING TIMELINE · group recent posts by month ────────────────────
     Ghost lists posts flat; consecutive posts from the same month hide
     their repeated month label, and each month gets the next toy colour.
     Without JS every post simply shows its own month.
  ─────────────────────────────────────────────────────────────────────── */
  function initTimeline(){
    var colors = ['#E3AE3C', '#C8402F', '#3F8A5C', '#2E5C9E'];
    document.querySelectorAll('[data-timeline]').forEach(function(tl){
      var prev = null, n = -1;
      tl.querySelectorAll('.tl-item').forEach(function(it){
        var m = it.getAttribute('data-month');
        if(m === prev){ it.classList.add('is-cont'); }
        else { n++; it.style.setProperty('--dot', colors[n % colors.length]); }
        prev = m;
      });
    });
  }

  /* ── INLINE TOYS · tap to play on touch screens ──────────────────────
     Hover plays the little icon animations on desktop (pure CSS). Phones
     have no hover, so a tap on a highlighted word plays it for a moment.
     Taps on links inside a word still follow the link.
  ─────────────────────────────────────────────────────────────────────── */
  function initKeywords(){
    document.querySelectorAll('.kw, .kw-pop').forEach(function(k){
      if(!k.querySelector('.kw-face, .pop')) return;
      var t;
      k.addEventListener('click', function(e){
        if(e.target.closest('a')) return;
        k.classList.remove('is-play'); void k.offsetWidth; k.classList.add('is-play');
        clearTimeout(t); t = setTimeout(function(){ k.classList.remove('is-play'); }, 2200);
      });
    });
  }

  /* ── MENU BAR · floating pill with sliding highlight ───────────────────
     A soft tab sits behind the current page. On hover (or keyboard focus)
     it glides to the hovered item, then returns when the pointer leaves.
     The header gets .is-scrolled once the page moves, which hides the
     time/weather and gives the theme button its own small pill.
  ─────────────────────────────────────────────────────────────────────── */
  function initNavPill(){
    var pill = document.querySelector('[data-nav-pill]');
    var header = document.getElementById('siteHeader');
    if(header){
      var ticking = false;
      var onScroll = function(){
        if(ticking) return; ticking = true;
        requestAnimationFrame(function(){ header.classList.toggle('is-scrolled', window.scrollY > 24); ticking = false; });
      };
      window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
    }
    if(!pill) return;
    var chip = pill.querySelector('.nav-chip');
    var home = pill.querySelector('.nav-home');
    var links = [].slice.call(pill.querySelectorAll('.nav a'));
    var items = (home ? [home] : []).concat(links);
    var norm = function(p){ return (p || '/').replace(/\/+$/, '') || '/'; };
    var path = norm(window.location.pathname);

    /* Current page: Ghost's own marker first, then a path match (posts → none) */
    var current = home && home.classList.contains('is-current') ? home : null;
    links.forEach(function(a){
      var li = a.closest('li'); var p;
      try{ p = norm(new URL(a.href, window.location.href).pathname); }catch(e){ return; }
      var hit = (li && li.classList.contains('nav-current')) || (p !== '/' && (path === p || path.indexOf(p + '/') === 0));
      if(hit && !current){ current = a; if(li) li.classList.add('nav-current'); a.setAttribute('aria-current','page'); }
    });
    if(!current && home && path === '/'){ current = home; home.classList.add('is-current'); }

    pill.classList.add('js-chip');
    function lit(el){ items.forEach(function(i){ i.classList.toggle('is-lit', i === el); }); }
    function place(el, instant){
      if(!chip) return;
      if(!el){ chip.style.opacity = '0'; lit(null); return; }
      if(instant) chip.classList.add('no-anim');
      chip.style.width = el.offsetWidth + 'px';
      chip.style.transform = 'translateX(' + el.offsetLeft + 'px)';
      chip.style.opacity = '1';
      lit(el);
      if(instant){ void chip.offsetWidth; chip.classList.remove('no-anim'); }
    }
    var canHover = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    items.forEach(function(el){
      if(canHover) el.addEventListener('mouseenter', function(){ place(el); });
      el.addEventListener('focus', function(){ place(el); });
    });
    if(canHover) pill.addEventListener('mouseleave', function(){ place(current); });
    pill.addEventListener('focusout', function(e){ if(!pill.contains(e.relatedTarget)) place(current); });
    place(current, true);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ place(current, true); });
    var t; window.addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(function(){ place(current, true); }, 120); });
  }

  /* ── NOW · fanned card deck ────────────────────────────────────────────
     Hover (mouse) fans the cards; touch screens keep them gently fanned.
     Click/tap a back card to bring it forward; tap the front card to open
     its link. Swipe, arrow buttons and ←/→ keys cycle the deck.
  ─────────────────────────────────────────────────────────────────────── */
  function initNowDeck(root){
    if(root._ndWired) return; root._ndWired = true;
    var stage = root.querySelector('.nd-stage');
    var cards = [].slice.call(root.querySelectorAll('.nd-card'));
    var items = [].slice.call(root.querySelectorAll('.nd-item'));
    var dots  = [].slice.call(root.querySelectorAll('.nd-dot'));
    if(!stage || cards.length < 2) return;
    var n = cards.length, order = cards.map(function(_, i){ return i; });
    var canHover = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var fanned = !canHover, startX = null, swiped = false;

    function layout(){
      var w = stage.clientWidth, cw = cards[0].offsetWidth;
      var spread = Math.max(40, Math.min(cw * 0.92, (w - cw) / 2 - 6));
      var stack = [[0,0,0,1],[18,-10,5,.95],[34,-18,9,.9]];
      var fan   = [[0,-8,0,1.03],[spread,14,10,.9],[-spread,14,-10,.9]];
      if(!canHover) fan = [[0,0,0,1],[spread*.62,18,9,.86],[-spread*.62,18,-9,.86]];
      cards.forEach(function(card, i){
        var rank = order.indexOf(i), p = (fanned ? fan : stack)[Math.min(rank, 2)];
        card.style.transform = 'translate('+p[0]+'px,'+p[1]+'px) rotate('+p[2]+'deg) scale('+p[3]+')';
        card.style.zIndex = n - rank;
        card.classList.toggle('is-front', rank === 0);
        card.setAttribute('tabindex', rank === 0 ? '0' : '-1');
      });
      var front = order[0];
      items.forEach(function(el, i){ el.classList.toggle('is-on', i === front); el.setAttribute('aria-hidden', i === front ? 'false' : 'true'); });
      dots.forEach(function(el, i){ el.classList.toggle('is-on', i === front); });
    }
    function bring(i){ order = [i].concat(order.filter(function(x){ return x !== i; })); layout(); }
    function step(dir){
      order = dir > 0 ? order.slice(1).concat(order[0]) : [order[n-1]].concat(order.slice(0, n-1));
      layout();
    }

    cards.forEach(function(card, i){
      card.addEventListener('click', function(e){
        if(swiped){ e.preventDefault(); swiped = false; return; }
        if(order[0] !== i){ e.preventDefault(); bring(i); }
      });
    });
    root.querySelectorAll('.nd-btn').forEach(function(b){
      b.addEventListener('click', function(){ step(+b.getAttribute('data-dir')); });
    });
    stage.addEventListener('keydown', function(e){
      if(e.key === 'ArrowRight'){ e.preventDefault(); step(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); step(-1); }
    });
    if(canHover){
      stage.addEventListener('mouseenter', function(){ fanned = true; layout(); });
      stage.addEventListener('mouseleave', function(){ fanned = false; layout(); });
    }
    stage.addEventListener('pointerdown', function(e){ startX = e.clientX; swiped = false; });
    stage.addEventListener('pointerup', function(e){
      if(startX === null) return;
      var dx = e.clientX - startX; startX = null;
      if(Math.abs(dx) > 40){ swiped = true; step(dx < 0 ? 1 : -1); }
    });
    stage.addEventListener('pointercancel', function(){ startX = null; });
    var t; window.addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(layout, 120); });
    layout();
  }
  function initNowDecks(){ document.querySelectorAll('[data-now-deck]').forEach(initNowDeck); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNowDecks);
  else initNowDecks();
})();

/* Writing page: show "New" on the latest essay only if it is under 45 days old */
(function(){
  function initNewBadge(){
    document.querySelectorAll('[data-new-since]').forEach(function(el){
      var d = new Date(el.getAttribute('data-new-since') + 'T00:00:00');
      if (!isNaN(d) && (Date.now() - d.getTime()) < 45 * 864e5) el.classList.add('is-new');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNewBadge); else initNewBadge();
})();
