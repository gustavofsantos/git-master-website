/* GitMaster site: walkthroughs recorded from the real app (tools/walkthroughs).
   Data: window.GM_WALKTHROUGHS from walkthroughs-data.js. Mount: <div data-walkthroughs>.
   Vanilla JS, no dependencies, no build step. */
(function () {
  'use strict';
  const DATA = window.GM_WALKTHROUGHS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP_MS = 5200;

  // A line whose first cell is reverse video is the cursor line; a mode badge (" NORMAL ") is not.
  const isCursor = (l) => /^<span class="[^"]*\brv\b/.test(l) && !/^<span class="bo rv"> [A-Z]+ <\/span>/.test(l);
  const lineHTML = (l) => `<span class="r${isCursor(l) ? ' cur' : ''}">${l || ' '}</span>`;

  // Pretty JSON with a little color, from data we control (recorded MCP answers).
  function json(v, ind = '') {
    const pad = ind + '  ';
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + json(x, pad)).join(',\n')}\n${ind}]` : '[]';
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      return ks.length ? `{\n${ks.map((k) => `${pad}<span class="jk">"${esc(k)}"</span>: ${json(v[k], pad)}`).join(',\n')}\n${ind}}` : '{}';
    }
    if (typeof v === 'string') return `<span class="js">"${esc(v).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>')}"</span>`;
    return `<span class="jn">${esc(String(v))}</span>`;
  }

  function mount(root) {
    if (!DATA || !DATA.walkthroughs) return;
    const list = DATA.walkthroughs;
    let wi = 0, si = 0, playing = false, timer = null, autoPaused = false;
    const rowsOf = (w) => Math.max(...w.steps.map((s) => s.screen.length));

    root.innerHTML = `<div class="wt">
      <div class="wt-tabs" role="tablist" aria-label="Walkthroughs">${list.map((w, i) => `<button role="tab" id="wt-tab-${w.id}" aria-controls="wt-panel" data-w="${i}"><span class="wk">${esc(w.kicker)}</span><span class="wn">${esc(w.title)}</span></button>`).join('')}</div>
      <div class="wt-panel" id="wt-panel" role="tabpanel">
        <div class="wt-head"><p class="wt-sum"></p></div>
        <div class="wt-grid">
          <ol class="wt-steps"></ol>
          <div class="wt-stage">
            <div class="wt-foot">
              <p class="wt-cap" aria-live="polite"></p>
              <div class="wt-ctl"><button class="btn sm" data-act="prev" aria-label="Previous step">←</button><span class="wt-n"></span><button class="btn sm" data-act="next" aria-label="Next step">→</button><button class="btn sm" data-act="play"></button></div>
            </div>
            <div class="tty"><div class="tty-bar"><i></i><i></i><i></i><span class="t"></span><span class="sp"></span><span class="chip plain">recorded</span></div>
              <pre class="tty-screen" aria-live="off"></pre></div>
            <div class="wt-agent" hidden><div class="wt-agent-h"><span class="dot"></span>Agent · MCP call</div><code class="call"></code><pre class="res"></pre></div>
          </div>
        </div>
      </div></div>`;
    const $ = (s) => root.querySelector(s);
    const screen = $('.tty-screen'), agent = $('.wt-agent');

    function render() {
      const w = list[wi], s = w.steps[si];
      root.querySelectorAll('.wt-tabs button').forEach((b, i) => { b.setAttribute('aria-selected', i === wi); b.tabIndex = i === wi ? 0 : -1; });
      $('#wt-panel').setAttribute('aria-labelledby', `wt-tab-${w.id}`);
      $('.wt-sum').textContent = w.summary;
      $('.wt-steps').innerHTML = w.steps.map((x, i) => `<li><button data-s="${i}" ${i === si ? 'aria-current="step"' : ''}><b>${i + 1}</b><span>${esc(x.title)}</span></button></li>`).join('');
      $('.tty-bar .t').textContent = s.kind === 'shell' ? 'bash' : 'gitmaster tui';
      screen.style.setProperty('--cols', w.cols);
      screen.style.setProperty('--rows', rowsOf(w));
      screen.className = `tty-screen ${s.kind}`;
      screen.setAttribute('aria-label', `Terminal: ${s.title}`);
      screen.innerHTML = s.screen.map(lineHTML).join('');
      if (s.agent) {
        agent.hidden = false;
        $('.wt-agent .call').textContent = s.agent.call;
        $('.wt-agent .res').innerHTML = '→ ' + json(s.agent.result);
      } else agent.hidden = true;
      $(".wt-cap").innerHTML = `<span><strong>${esc(s.title)}.</strong> ${esc(s.caption)}</span>`;
      $('.wt-n').textContent = `${si + 1} / ${w.steps.length}`;
      $('[data-act="play"]').textContent = playing ? '❚❚ Pause' : '▶ Play';
      $('[data-act="play"]').setAttribute('aria-pressed', playing);
    }
    function go(w, s) {
      wi = (w + list.length) % list.length;
      const n = list[wi].steps.length;
      si = Math.max(0, Math.min(n - 1, s));
      render();
    }
    function tick() {
      const n = list[wi].steps.length;
      if (si < n - 1) go(wi, si + 1); else go(wi + 1, 0);
    }
    function play(on, auto = false) {
      autoPaused = auto && !on;
      playing = on;
      clearInterval(timer);
      if (on) timer = setInterval(tick, STEP_MS);
      render();
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.w) { play(false); go(+b.dataset.w, 0); }
      else if (b.dataset.s) { play(false); go(wi, +b.dataset.s); }
      else if (b.dataset.act === 'next') { play(false); si < list[wi].steps.length - 1 ? go(wi, si + 1) : go(wi + 1, 0); }
      else if (b.dataset.act === 'prev') { play(false); si > 0 ? go(wi, si - 1) : go(wi - 1, list[(wi - 1 + list.length) % list.length].steps.length - 1); }
      else if (b.dataset.act === 'play') play(!playing);
    });
    root.querySelector('.wt-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); play(false);
      go(wi + (e.key === 'ArrowRight' ? 1 : -1), 0);
      root.querySelector(`.wt-tabs [data-w="${wi}"]`).focus();
    });
    root.addEventListener('keydown', (e) => {
      if (e.target.closest('.wt-tabs')) return;
      if (e.key === 'ArrowRight') { play(false); tick(); } else if (e.key === 'ArrowLeft') { root.querySelector('[data-act="prev"]').click(); }
    });
    // Start playing once the section is on screen; stop when it leaves.
    if (!reduced && 'IntersectionObserver' in window) {
      let started = false;
      new IntersectionObserver((es) => es.forEach((en) => {
        if (en.isIntersecting && (!started || autoPaused)) { started = true; play(true); }
        else if (!en.isIntersecting && playing) play(false, true);
      }), { threshold: 0.35 }).observe(root);
    }
    // Deep link: #walkthroughs/<id>
    const m = location.hash.match(/^#walkthroughs\/([\w-]+)/);
    const start = m ? list.findIndex((w) => w.id === m[1]) : -1;
    go(start >= 0 ? start : 0, 0);
  }

  const boot = () => document.querySelectorAll('[data-walkthroughs]').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
