/* ════════════════════════════════
   MASCOT  ·  a head that watches the cursor and reacts when booped.
   Vanilla port of page-mascot by Kamran Ahmed (MIT):
   https://github.com/nilbuild/page-mascot
   Markup: <button class="mascot" data-directions="…" data-reactions="…">
   ════════════════════════════════ */
(function(){
  'use strict';

  var DIRECTIONS = ['up-left','up','up-right','left','center','right','down-left','down','down-right'];
  var REACTIONS  = ['blink','heart','sparkle','surprised','wink','bashful','sleepy','dizzy','delighted'];
  // Clockwise from the right, matching atan2 with y pointing down.
  var CLOCKWISE  = ['right','down-right','down','down-left','left','up-left','up','up-right'];
  var SECTOR = Math.PI * 2 / CLOCKWISE.length, HYSTERESIS = 0.12, DEAD_ZONE = 70;
  var PAYOFFS = ['heart','sparkle','delighted'];
  var BOOP_PAYOFF = 120, BOOP_END = 560, SQUASH_MS = 420;
  var DIZZY_AFTER = 4, DIZZY_WINDOW = 1600, DIZZY_END = 1100;
  var SQUASH = [
    { transform: 'scale(1, 1)', easing: 'ease-in' },
    { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
    { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
    { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
    { transform: 'scale(1, 1)' }
  ];

  // background-size 300% makes each cell a clean 0/50/100% step on both axes.
  function cell(el, list, name){
    var i = list.indexOf(name);
    el.style.backgroundPosition = (i % 3) * 50 + '% ' + Math.floor(i / 3) * 50 + '%';
  }
  function wrap(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }

  function mount(btn){
    var squash = document.createElement('span');
    var dirs = document.createElement('span');
    var reac = document.createElement('span');
    squash.className = 'mascot-squash';
    dirs.className = 'mascot-layer';
    reac.className = 'mascot-layer';
    dirs.style.backgroundImage = 'url(' + btn.dataset.directions + ')';
    // Always present so the sheet loads up front, never on the first click.
    reac.style.backgroundImage = 'url(' + btn.dataset.reactions + ')';
    reac.style.opacity = 0;
    cell(dirs, DIRECTIONS, 'center');
    cell(reac, REACTIONS, 'blink');
    squash.appendChild(dirs); squash.appendChild(reac); btn.appendChild(squash);

    var timers = [], boops = { count: 0, at: 0 };

    function react(name){
      if(name){ cell(reac, REACTIONS, name); reac.style.opacity = 1; dirs.style.opacity = 0; }
      else { reac.style.opacity = 0; dirs.style.opacity = 1; }
    }

    if(window.matchMedia('(hover: hover) and (pointer: fine)').matches){
      var sector = -1, pointer = null;
      var aim = function(){
        if(!pointer) return;
        var box = btn.getBoundingClientRect();
        var dx = pointer.x - (box.left + box.width / 2);
        var dy = pointer.y - (box.top + box.height / 2);
        if(Math.hypot(dx, dy) < DEAD_ZONE){ sector = -1; cell(dirs, DIRECTIONS, 'center'); return; }
        // Hold the current sector until the pointer is well past its edge.
        var angle = Math.atan2(dy, dx);
        if(sector !== -1 && Math.abs(wrap(angle - sector * SECTOR)) < SECTOR / 2 + HYSTERESIS) return;
        sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
        cell(dirs, DIRECTIONS, CLOCKWISE[sector]);
      };
      window.addEventListener('pointermove', function(e){ pointer = { x: e.clientX, y: e.clientY }; aim(); }, { passive: true });
      window.addEventListener('scroll', aim, { passive: true });
    }

    btn.addEventListener('click', function(){
      timers.forEach(clearTimeout); timers = [];
      var later = function(ms, next){ timers.push(setTimeout(function(){ react(next); }, ms)); };
      var now = Date.now();
      boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1;
      boops.at = now;
      if(boops.count >= DIZZY_AFTER){
        boops.count = 0; react('dizzy'); later(DIZZY_END, null);
      } else {
        react('blink');
        later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length]);
        later(BOOP_END, null);
      }
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !squash.animate) return;
      squash.animate(SQUASH, { duration: SQUASH_MS, easing: 'linear' });
    });
  }

  document.querySelectorAll('.mascot[data-directions][data-reactions]').forEach(mount);
})();
