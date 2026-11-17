/* GitMaster site: real screens recorded from the app (tools/walkthroughs).
   Data: window.GM_WALKTHROUGHS from walkthroughs-data.js.
   Mounts: <div data-walkthrough="<id>"> plays a walkthrough step by step;
           <div data-screen="<id>:<step>"> shows one recorded screen.
   Vanilla JS, no dependencies, no build step. */
(function () {
  'use strict';
  const DATA = window.GM_WALKTHROUGHS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP_MS = 6000;
  const byId = (id) => DATA && DATA.walkthroughs.find((w) => w.id === id);

  // A line whose first cell is reverse video is the cursor line; a mode badge (" NORMAL ") is not.
  const isCursor = (l) => /^<span class="[^"]*\brv\b/.test(l) && !/^<span class="bo rv"> [A-Z]+ <\/span>/.test(l);
  const lines = (screen) => screen.map((l) => `<span class="r${isCursor(l) ? ' cur' : ''}">${l || ' '}</span>`).join('');
  const rowsOf = (w) => Math.max(...w.steps.map((s) => s.screen.length));

  function tty(w, label) {
    return `<div class="tty" style="--cols:${w.cols};--rows:${rowsOf(w)}"><pre class="tty-screen" role="img" aria-label="${esc(label)}"></pre></div>`;
  }

  // Indented JSON, from data we control (recorded MCP answers). [x] in a snippet is a search hit.
  function json(v, ind = '') {
    const pad = ind + '  ';
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + json(x, pad)).join(',\n')}\n${ind}]` : '[]';
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      return ks.length ? `{\n${ks.map((k) => `${pad}"${esc(k)}": ${json(v[k], pad)}`).join(',\n')}\n${ind}}` : '{}';
    }
    if (typeof v === 'string') return `"${esc(v).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>')}"`;
    return esc(String(v));
  }

  function mountScreen(el) {
    const [id, n] = el.dataset.screen.split(':');
    const w = byId(id), s = w && w.steps[+n];
    if (!s) return;
    el.innerHTML = tty(w, `Terminal: ${s.title}`);
    el.querySelector('.tty-screen').innerHTML = lines(s.screen);
  }

  function mountWalk(root) {
    const w = byId(root.dataset.walkthrough);
    if (!w) return;
    const n = w.steps.length;
    let i = 0, playing = false, timer = null, autoPaused = false, started = false;
    root.innerHTML = `${tty(w, '')}
      <div class="walk-text">
        <p class="walk-step" aria-live="polite"></p>
        <div class="walk-ctl">
          <button type="button" data-act="prev">← Back</button>
          <button type="button" data-act="next">Next →</button>
          <button type="button" data-act="play"></button>
          <span class="walk-dots">${w.steps.map((s, k) => `<button type="button" data-s="${k}" aria-label="Step ${k + 1}: ${esc(s.title)}"></button>`).join('')}</span>
        </div>
      </div>
      <div class="walk-agent" hidden><p>Meanwhile, the agent calls <code class="call"></code> and gets back:</p><pre class="res"></pre></div>`;
    const $ = (s) => root.querySelector(s);

    function render() {
      const s = w.steps[i];
      const scr = $('.tty-screen');
      scr.innerHTML = lines(s.screen);
      scr.setAttribute('aria-label', `Terminal, step ${i + 1} of ${n}: ${s.title}`);
      $('.walk-step').innerHTML = `<span class="walk-n">${i + 1}/${n}</span> <strong>${esc(s.title)}.</strong> ${esc(s.caption)}`;
      $('[data-act="prev"]').disabled = i === 0;
      $('[data-act="next"]').textContent = i === n - 1 ? 'Start over' : 'Next →';
      $('[data-act="play"]').textContent = playing ? 'Pause' : 'Play';
      root.querySelectorAll('.walk-dots button').forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
      const agent = $('.walk-agent');
      agent.hidden = !s.agent;
      if (s.agent) {
        $('.walk-agent .call').textContent = s.agent.call;
        $('.walk-agent .res').innerHTML = json(s.agent.result);
      }
    }
    const go = (k) => { i = (k + n) % n; render(); };
    function play(on, auto = false) {
      autoPaused = auto && !on;
      playing = on;
      clearInterval(timer);
      if (on) timer = setInterval(() => go(i + 1), STEP_MS);
      render();
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) { play(false); go(+b.dataset.s); }
      else if (b.dataset.act === 'next') { play(false); go(i + 1); }
      else if (b.dataset.act === 'prev') { play(false); go(i - 1); }
      else if (b.dataset.act === 'play') play(!playing);
    });
    // Plays while it is on screen, unless the reader took over or asked for less motion.
    if (!reduced && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((en) => {
        if (en.isIntersecting && (!started || autoPaused)) { started = true; play(true); }
        else if (!en.isIntersecting && playing) play(false, true);
      }), { threshold: 0.5 }).observe(root);
    }
    render();
  }

  function boot() {
    document.querySelectorAll('[data-screen]').forEach(mountScreen);
    document.querySelectorAll('[data-walkthrough]').forEach(mountWalk);
    document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(document.querySelector(b.dataset.copy).textContent.trim()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500); } catch (_) { /* clipboard blocked */ }
    }));
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
