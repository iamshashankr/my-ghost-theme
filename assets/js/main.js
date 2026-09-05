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

    /* Active nav */
    var path = window.location.pathname;
    document.querySelectorAll('.site-nav a').forEach(function(a){
      var href = a.getAttribute('href'); if(!href) return;
      var li = a.closest('li'); if(!li) return;
      if(href==='/'&&path==='/') li.classList.add('current');
      else if(href!=='/'&&path.startsWith(href)) li.classList.add('current');
    });


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
})();
