/* GitMaster site: interactive mockups. Vanilla JS, no dependencies, no build step.
   Mount points: <div data-demo="review|stacks|threads|staging">, <div data-hero-graph>. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const winBar = (title, right = '') => `<div class="win-bar"><i></i><i></i><i></i><span class="t">${title}</span><span class="sp"></span>${right}</div>`;

  /* ------------------------------------------------------------------ graph */
  // commits: [id, lane, parents[]] bottom (oldest) to top (newest).
  const LANE_COLOR = ['var(--faint)', 'var(--violet)', 'var(--cyan)', 'var(--orange)', 'var(--magenta)', 'var(--blue)'];
  function graphSVG(commits, o = {}) {
    const dx = o.dx || 56, dy = o.dy || 26, pad = 24, left = 26;
    const labelX = o.labelX || (Math.max(...commits.map((c) => c[1])) * dx + left + 34);
    const W = o.width || labelX + 130, H = commits.length * dy + pad * 2;
    const pos = {};
    commits.forEach((c, i) => (pos[c[0]] = { x: left + c[1] * dx, y: H - pad - i * dy, lane: c[1] }));
    const stale = o.stale || new Set();
    let edges = '', nodes = '', labels = '';
    commits.forEach((c) => {
      const a = pos[c[0]];
      c[2].forEach((p) => {
        const b = pos[p];
        if (!b) return;
        const ym = (a.y + b.y) / 2;
        const d = a.x === b.x ? `M${a.x} ${a.y}L${b.x} ${b.y}` : `M${a.x} ${a.y}C${a.x} ${ym} ${b.x} ${ym} ${b.x} ${b.y}`;
        const isStale = stale.has(c[0] + '>' + p);
        edges += `<path class="edge ${isStale ? 'stale' : ''} ${o.draw ? 'draw' : ''}" d="${d}" style="${isStale ? '' : `stroke:${LANE_COLOR[a.lane % 6]}`}"/>`;
        if (isStale && o.staleLabel) edges += `<text x="${a.x + 14}" y="${a.y + 17}" style="fill:var(--yellow)">${esc(o.staleLabel)}</text>`;
      });
    });
    commits.forEach((c) => {
      const a = pos[c[0]];
      nodes += `<circle class="node" cx="${a.x}" cy="${a.y}" r="4.5" fill="${LANE_COLOR[a.lane % 6]}"><title>${esc(c[0])}</title></circle>`;
    });
    Object.entries(o.labels || {}).forEach(([id, t]) => {
      const a = pos[id];
      if (a) labels += `<text x="${labelX}" y="${a.y + 4}" style="fill:var(--fg)">${esc(t)}</text>`;
    });
    return `<svg class="graph" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria || 'Commit graph')}" style="max-height:${o.maxH || 'none'}">${edges}${nodes}${labels}</svg>`;
  }

  /* ------------------------------------------------------------------ hero graph */
  function mountHeroGraph(el) {
    const C = [
      ['m1', 0, []], ['m2', 0, ['m1']], ['m3', 0, ['m2']], ['a1', 1, ['m3']], ['m4', 0, ['m3']], ['a2', 1, ['a1']],
      ['b1', 2, ['m4']], ['m5', 0, ['m4']], ['a3', 1, ['a2']], ['b2', 2, ['b1']], ['c1', 3, ['b2']], ['m6', 0, ['m5', 'a3']],
      ['b3', 2, ['b2']], ['c2', 3, ['c1']], ['m7', 0, ['m6']], ['d1', 4, ['m7']], ['b4', 2, ['b3']], ['c3', 3, ['c2']], ['m8', 0, ['m7', 'b4']], ['d2', 4, ['d1']], ['m9', 0, ['m8', 'c3']],
    ];
    el.innerHTML = graphSVG(C, { draw: !reduced, dx: 44, dy: 22, labelX: 230, width: 300, aria: 'Decorative commit graph', labels: { m9: 'main', d2: 'agent/fix-retry', c3: 'feature/ui', b4: 'refactor/base' } });
  }

  /* ------------------------------------------------------------------ review loop */
  const REVIEW_STEPS = [
    ['Agent edits', 'Your agent changes the code. It lands in the Working Copy where you can read it, not in a branch you have never seen.'],
    ['You comment', 'Select lines, press Ctrl+Shift+M, and say what is wrong. No pull request, no push, no waiting for CI.'],
    ['Agent reads', 'The agent calls review_comments_list over MCP and gets your comments as data, anchored to the exact lines.'],
    ['Agent fixes', 'It changes the code and marks the comment handled. GitMaster does not trust that summary: it measures the change from snapshots of the working tree.'],
    ['You resolve', 'You read the Before and After, then resolve the comment, or reopen it and send it back.'],
  ];
  const L = {
    sig: (v) => v ? `<span class="k">pub fn</span> <span class="f">post</span>(&amp;<span class="k">mut self</span>, entry: <span class="ty">Entry</span>) -&gt; <span class="ty">Result</span>&lt;<span class="ty">Balance</span>, <span class="ty">LedgerError</span>&gt; {` : `<span class="k">pub fn</span> <span class="f">post</span>(&amp;<span class="k">mut self</span>, entry: <span class="ty">Entry</span>) -&gt; <span class="ty">Balance</span> {`,
    get: (v) => v ? `    <span class="k">let</span> acct = <span class="k">self</span>.accounts.<span class="f">get</span>(&amp;entry.id).<span class="f">ok_or</span>(<span class="ty">LedgerError</span>::<span class="ty">NoAccount</span>)<span class="k">?</span>;` : `    <span class="k">let</span> acct = <span class="k">self</span>.accounts.<span class="f">get</span>(&amp;entry.id).<span class="f">unwrap</span>();`,
    ret: (v) => v ? `    <span class="ty">Ok</span>(acct.<span class="f">apply</span>(entry))` : `    acct.<span class="f">apply</span>(entry)`,
  };
  function mountReview(root) {
    let step = 0, resolved = false, timer = null;
    const render = () => {
      const fixed = step >= 3;
      const sel = step >= 1 ? 'sel' : '';
      const comment = step >= 1 ? `<div class="cmt"><span class="who">You</span><span class="chip ${resolved ? 'green' : fixed ? 'amber' : 'blue'}">${resolved ? 'Resolved' : fixed ? 'Handled' : 'Open'}</span><div style="margin-top:4px">Return an error here instead of unwrapping.</div></div>` : '';
      const diff = `<div class="diff">
        <div class="dl"><span class="g"></span><span class="ln">40</span><span class="cm">// src/ledger.rs</span></div>
        <div class="dl add"><span class="g">+</span><span class="ln">41</span><span>${L.sig(fixed)}</span></div>
        <div class="dl add ${sel}"><span class="g">+</span><span class="ln">42</span><span>${L.get(fixed)}</span></div>
        ${comment}
        <div class="dl add"><span class="g">+</span><span class="ln">43</span><span>${L.ret(fixed)}</span></div>
        <div class="dl"><span class="g"></span><span class="ln">44</span><span>}</span></div></div>`;
      const log = step < 2 ? '' : `<div class="agent-card fade-in"><h6>Agent · Claude Code</h6><div class="log">
        <span class="${step === 2 ? 'run' : 'ok'}">${step === 2 ? '…' : '✓'} review_comments_list → 1 open</span>
        ${step >= 3 ? '<span class="ok">✓ edit src/ledger.rs</span><span class="ok">✓ review_comment_resolve</span>' : '<span class="run">… working</span>'}</div></div>`;
      const observed = step < 3 ? '' : `<div class="info-card fade-in"><h6>Observed by GitMaster</h6>
        <div class="mono-s">src/ledger.rs <span style="color:var(--green)">+3</span> <span style="color:var(--red)">−3</span></div>
        <div style="margin-top:4px;color:var(--muted)">Touches the lines you commented on (41–43). Measured from working-tree snapshots, not from the agent's summary.</div>
        <div style="margin-top:8px;display:grid;gap:3px"><span class="mono-s" style="color:var(--red)">− …get(&amp;entry.id).unwrap();</span><span class="mono-s" style="color:var(--green)">+ …ok_or(LedgerError::NoAccount)?;</span></div></div>`;
      const action = step === 4 && !resolved ? `<div style="padding:0 10px 10px"><button class="btn sm primary" data-act="resolve">Resolve Comment</button> <button class="btn sm" data-act="reopen">Reopen</button></div>` : '';
      const list = step >= 1 ? `<div class="info-card"><h6>Local review · 1 comment</h6><div class="mono-s">src/ledger.rs:42</div><div style="margin-top:4px"><span class="chip ${resolved ? 'green' : fixed ? 'amber' : 'blue'}">${resolved ? 'Resolved' : fixed ? 'Handled' : 'Open'}</span></div></div>` : `<div class="info-card"><h6>Local review</h6><span style="color:var(--muted)">No comments yet.</span></div>`;
      root.innerHTML = `<div class="demo review"><div class="steps" role="tablist">${REVIEW_STEPS.map((s, i) => `<button role="tab" data-i="${i}" ${i === step ? 'aria-current="step"' : ''}><b>${i + 1}</b>${s[0]}</button>`).join('')}</div>
        <div class="win">${winBar('GitMaster · ledger — Working Copy', '<span class="chip plain">agent/ledger-errors</span>')}<div class="win-body"><div class="pane"><div class="pane-h"><strong>src/ledger.rs</strong><span class="chip plain">unstaged</span></div>${diff}</div><div class="side" style="border-left:1px solid var(--border);border-right:0">${list}${log}${observed}${action}</div></div></div>
        <p class="caption" aria-live="polite">${REVIEW_STEPS[step][1]}</p>
        <div class="controls"><button class="btn sm primary" data-act="next">${step === 4 ? 'Replay' : 'Next step →'}</button><span style="color:var(--muted);font-size:.85rem">Interactive mockup</span></div></div>`;
    };
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.i) { step = +t.dataset.i; resolved = false; }
      else if (t.dataset.act === 'next') { step = step === 4 ? 0 : step + 1; resolved = false; }
      else if (t.dataset.act === 'resolve') resolved = true;
      else if (t.dataset.act === 'reopen') { step = 1; resolved = false; }
      render();
    });
    render();
  }

  /* ------------------------------------------------------------------ stacks */
  function mountStacks(root) {
    let moved = false, restacked = false, busy = 0;
    const commits = () => {
      const base = [['m1', 0, []], ['m2', 0, ['m1']], ['m3', 0, ['m2']]];
      const stack = (parent) => [['b1', 1, [parent]], ['b2', 1, ['b1']], ['b3', 1, ['b2']], ['u1', 2, ['b3']], ['u2', 2, ['u1']], ['a1', 3, ['b3']], ['a2', 3, ['a1']]];
      if (!moved) return [...base, ...stack('m3')];
      if (!restacked) return [...base, ...stack('m3'), ['m4', 0, ['m3']], ['m5', 0, ['m4']]];
      return [...base, ['m4', 0, ['m3']], ['m5', 0, ['m4']], ...stack('m5')];
    };
    const render = () => {
      const stale = moved && !restacked;
      const g = graphSVG(commits(), { dx: 50, dy: 27, labelX: 210, width: 360, stale: new Set(stale ? ['b1>m3'] : []), staleLabel: '2 behind main', labels: { [moved ? 'm5' : 'm3']: 'main', b3: 'refactor/base', u2: 'feature/ui', a2: 'feature/api' }, aria: 'Branch stack graph' });
      const dotc = stale ? 'amber' : 'green';
      const side = `<div class="side"><h6>Branches · by stack</h6>
        <div class="row act"><span class="dot"></span>main${stale ? ' <button class="btn sm primary" style="margin-left:auto;padding:1px 8px" data-act="restack">restack 3</button>' : ''}</div>
        <div class="row ind1"><span class="dot ${dotc}"></span>refactor/base<span class="n">↑3</span></div>
        <div class="row ind2"><span class="dot ${dotc}"></span>feature/ui<span class="n">↑2</span></div>
        <div class="row ind2"><span class="dot ${dotc}"></span>feature/api<span class="n">↑2</span></div>
        <h6>No stack</h6><div class="row"><span class="dot"></span>fix/typo</div></div>`;
      const status = busy ? `<div class="agent-card fade-in" style="position:absolute;right:12px;bottom:12px;width:230px"><h6>Restack · plan → run → done</h6><div class="log">${['refactor/base → main', 'feature/ui → refactor/base', 'feature/api → refactor/base'].map((s, i) => `<span class="${busy > i + 1 ? 'ok' : busy === i + 1 ? 'run' : ''}">${busy > i + 1 ? '✓' : busy === i + 1 ? '…' : '·'} ${s}</span>`).join('')}</div></div>` : restacked ? `<div class="agent-card fade-in" style="position:absolute;right:12px;bottom:12px;width:230px"><h6>Restack done</h6><div style="color:var(--muted)">3 branches rebased, 0 conflicts. A ref snapshot was saved.</div><div style="margin-top:6px"><button class="btn sm" data-act="undo">Undo restack</button></div></div>` : '';
      root.innerHTML = `<div class="demo stacks"><div class="win">${winBar('GitMaster · history — Stacks', '<span class="chip amber">preview</span>')}<div class="win-body">${side}<div class="pane fade-in" style="position:relative;padding:8px 12px">${g}${status}</div></div></div>
        <p class="caption" aria-live="polite">${!moved ? 'Three small branches stacked on each other, each with one parent. Everything is in sync.' : stale ? 'main moved. The base of your stack is now behind, shown as a dashed amber edge, and one click away from a restack.' : 'Restacked with an exact plan per commit. The snapshot makes it one click to undo.'}</p>
        <div class="controls">${!moved ? '<button class="btn sm primary" data-act="move">Land 2 commits on main</button>' : '<button class="btn sm" data-act="reset">Reset</button>'}<span style="color:var(--muted);font-size:.85rem">Interactive mockup · stacked branches are a preview feature</span></div></div>`;
    };
    const run = () => { busy = 1; render(); const tick = () => { busy++; if (busy > 3) { busy = 0; restacked = true; render(); return; } render(); setTimeout(tick, reduced ? 0 : 520); }; setTimeout(tick, reduced ? 0 : 520); };
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t || busy) return;
      const a = t.dataset.act;
      if (a === 'move') moved = true; else if (a === 'reset') { moved = false; restacked = false; }
      else if (a === 'undo') restacked = false; else if (a === 'restack') return run();
      render();
    });
    render();
  }

  /* ------------------------------------------------------------------ threads */
  const THREADS = [
    { t: 'Add retry to the sync client', br: 'feat/sync-retry', age: '3 weeks ago', edits: 2, turns: [['you', 'Add retry with exponential backoff to the sync client.'], ['tool', 'Edit src/sync/client.rs'], ['edit', 'src/sync/client.rs', 22, 3], ['agent', 'Added a retry loop with backoff, capped at five attempts.'], ['you', 'Drop the retry loop. The server already retries idempotent calls.'], ['agent', 'Removed it. A second layer would multiply the delay: five client attempts times the server\'s three. Kept only the timeout.'], ['edit', 'src/sync/client.rs', 2, 24]] },
    { t: 'Speed up status in large repositories', br: 'perf/status', age: '1 week ago', edits: 3, turns: [['you', 'Working Copy takes 4 seconds in the monorepo. Why?'], ['tool', 'Bash git status --porcelain=v2'], ['agent', 'libgit2 does not use fsmonitor or the untracked cache. Shelling out to git status is 20× faster here, so the hybrid backend uses the subprocess for status.'], ['edit', 'crates/gm-core/src/git/status.rs', 41, 12]] },
    { t: 'Migrate the threads store to SQLite', br: 'feat/threads-db', age: '2 weeks ago', edits: 6, turns: [['you', 'Where should we keep recorded sessions?'], ['agent', 'Inside .git/gitmaster as SQLite. Nothing lands in the working tree, and every linked worktree sees the same store.'], ['tool', 'Write crates/gm-core/src/store/threads.rs'], ['edit', 'crates/gm-core/src/store/threads.rs', 188, 0]] },
    { t: 'Fix flaky history graph test', br: 'fix/graph-test', age: '5 days ago', edits: 1, turns: [['you', 'graph_scroll fails one run in twenty.'], ['agent', 'A race with the watcher debounce. The test slept for 50 ms; it now waits for the RepoChanged event instead of guessing.'], ['edit', 'crates/gm-ui/tests/graph_scroll.rs', 6, 4]] },
    { t: 'Rename Session to Thread', br: 'chore/rename', age: '2 days ago', edits: 9, turns: [['you', 'Rename Session to Thread everywhere, including the schema.'], ['agent', 'Renamed across gm-schema, gm-core and gm-ui. Stored data migrates on first open.'], ['edit', 'crates/gm-schema/src/thread.rs', 31, 31]] },
  ];
  const textOf = (th) => (th.t + ' ' + th.br + ' ' + th.turns.map((x) => x.slice(1).join(' ')).join(' ')).toLowerCase();
  function mountThreads(root) {
    let q = '', sel = 0;
    const terms = () => q.toLowerCase().split(/\s+/).filter(Boolean);
    const hl = (s) => { let h = esc(s); terms().forEach((t) => { h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>'); }); return h; };
    const render = (keepFocus) => {
      const hits = THREADS.map((th, i) => ({ th, i })).filter(({ th }) => terms().every((t) => textOf(th).includes(t)));
      if (!hits.find((h) => h.i === sel) && hits.length) sel = hits[0].i;
      const cur = hits.find((h) => h.i === sel);
      const list = hits.length ? hits.map(({ th, i }) => `<button class="item" role="option" aria-selected="${i === sel}" data-i="${i}"><span class="ti">${hl(th.t)}</span><span class="me"><span>${esc(th.br)}</span><span>${th.age}</span><span>${th.edits} edits</span></span></button>`).join('') : '<div style="padding:16px;color:var(--muted)">No thread matches.</div>';
      const detail = cur ? `<div class="pane"><div class="pane-h"><strong>${hl(cur.th.t)}</strong></div><div class="pane-h" style="gap:6px;flex-wrap:wrap"><span class="chip plain">Claude Code</span><span class="chip plain">${esc(cur.th.br)}</span><span class="chip plain">${cur.th.edits} edits</span><span class="chip plain">${cur.th.age}</span></div>${cur.th.turns.map((x) => x[0] === 'you' ? `<div class="turn"><div class="who you">You</div>${hl(x[1])}</div>` : x[0] === 'agent' ? `<div class="turn"><div class="who">Agent</div>${hl(x[1])}</div>` : x[0] === 'tool' ? `<div class="turn" style="padding:4px 16px"><div class="tool">▸ ${hl(x[1])} <span style="color:var(--green)">✓</span></div></div>` : `<div class="turn" style="padding:4px 16px"><div class="edit"><span>${hl(x[1])}</span><span class="a">+${x[2]}</span><span class="d">−${x[3]}</span><span class="chip blue" style="margin-left:auto">Open Diff</span></div></div>`).join('')}</div>` : '<div class="pane"></div>';
      const presets = ['retry', 'sqlite', 'fsmonitor', 'worktree'];
      root.innerHTML = `<div class="demo threads"><div class="win">${winBar('GitMaster · Threads')}<div class="win-body"><div class="side" style="padding:0"><label class="search"><span aria-hidden="true">⌕</span><span class="sr">Search threads</span><input type="search" placeholder="Search every session…" value="${esc(q)}" autocomplete="off"></label><div class="tl" role="listbox">${list}</div></div>${detail}</div></div>
        <div class="controls"><span style="color:var(--muted);font-size:.85rem">Try:</span>${presets.map((p) => `<button class="btn sm" data-p="${p}">${p}</button>`).join('')}<span style="color:var(--muted);font-size:.85rem">Interactive mockup</span></div></div>`;
      if (keepFocus) { const i = $('input', root); i.focus(); i.setSelectionRange(q.length, q.length); }
    };
    root.addEventListener('input', (e) => { if (e.target.matches('input')) { q = e.target.value; render(true); } });
    root.addEventListener('click', (e) => {
      const it = e.target.closest('.item'), p = e.target.closest('[data-p]');
      if (it) { sel = +it.dataset.i; render(); } else if (p) { q = p.dataset.p; render(); }
    });
    render();
  }

  /* ------------------------------------------------------------------ line staging */
  function mountStaging(root) {
    const lines = [
      { k: 'ctx', n: 17, h: `<span class="k">fn</span> <span class="f">fee</span>(&amp;<span class="k">self</span>, amount: <span class="ty">i64</span>) -&gt; <span class="ty">i64</span> {` },
      { k: 'del', n: 18, h: `    amount * <span class="nu">3</span> / <span class="nu">100</span>`, grp: 1 },
      { k: 'add', n: 18, h: `    <span class="k">let</span> rate = <span class="k">self</span>.config.fee_rate;`, grp: 1 },
      { k: 'add', n: 19, h: `    (amount * rate) / <span class="nu">10_000</span>`, grp: 1 },
      { k: 'ctx', n: 20, h: `}` },
      { k: 'add', n: 21, h: `<span class="mc">dbg!</span>(&amp;<span class="k">self</span>.entries); <span class="cm">// temp</span>` },
    ];
    const staged = new Set(); let read = false;
    const idx = lines.map((l, i) => (l.k === 'ctx' ? -1 : i)).filter((i) => i >= 0);
    const render = () => {
      const grp = idx.filter((i) => lines[i].grp), gs = grp.filter((i) => staged.has(i)).length;
      const half = gs > 0 && gs < grp.length;
      const rows = lines.map((l, i) => l.k === 'ctx' ? `<div class="dl"><span class="g"></span><span class="ln">${l.n}</span><span>${l.h}</span></div>` : `<div class="dl ${l.k} ${staged.has(i) ? 'staged' : ''}" style="grid-template-columns:22px 34px 1fr"><label style="display:contents"><span class="g" style="display:grid;place-items:center"><input class="cb" type="checkbox" data-i="${i}" ${staged.has(i) ? 'checked' : ''} aria-label="Stage line ${l.n}"></span><span class="ln">${l.n}</span><span>${l.k === 'del' ? '−' : '+'} ${l.h}</span></label></div>`).join('');
      const pct = Math.round((staged.size / idx.length) * 100);
      root.innerHTML = `<div class="demo staging"><div class="win">${winBar('GitMaster · Working Copy')}<div class="win-body"><div class="pane"><div class="pane-h"><strong>src/ledger.rs</strong><span class="chip plain">@@ −17,4 +17,6 @@</span><span style="margin-left:auto">${staged.size} of ${idx.length} lines staged</span></div><div class="diff">${rows}</div></div>
        <div class="side" style="border-left:1px solid var(--border);border-right:0"><div class="info-card"><h6>Commit</h6><div class="meter" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><div style="margin:6px 0;color:var(--muted)">Staged + unstaged always equals the full change.</div><button class="btn sm primary" ${staged.size ? '' : 'disabled style="opacity:.5"'}>Commit ${staged.size} line${staged.size === 1 ? '' : 's'}</button></div>
        <div class="info-card"><h6>Read ≠ staged</h6><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-read ${read ? 'checked' : ''}> Mark this hunk as read</label><div style="color:var(--muted);margin-top:4px">A reminder of what you have reviewed. It resets if the hunk changes.</div></div>
        ${half ? '<div class="warn fade-in"><strong>Half a replacement is staged.</strong> The index would lose the old line without gaining the new one, and may not compile.</div>' : ''}</div></div></div>
        <div class="controls"><button class="btn sm" data-act="all">Stage hunk</button><button class="btn sm" data-act="none">Unstage all</button><button class="btn sm" data-act="demo">Stage all but the dbg! line</button><span style="color:var(--muted);font-size:.85rem">Interactive mockup</span></div></div>`;
    };
    root.addEventListener('change', (e) => {
      if (e.target.dataset.i) { const i = +e.target.dataset.i; e.target.checked ? staged.add(i) : staged.delete(i); }
      else if ('read' in e.target.dataset) read = e.target.checked;
      render();
    });
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
      staged.clear();
      if (a === 'all') idx.forEach((i) => staged.add(i)); else if (a === 'demo') idx.slice(0, 3).forEach((i) => staged.add(i));
      render();
    });
    render();
  }

  /* ------------------------------------------------------------------ boot + helpers */
  const MOUNT = { review: mountReview, stacks: mountStacks, threads: mountThreads, staging: mountStaging };
  function boot() {
    $$('[data-demo]').forEach((el) => MOUNT[el.dataset.demo]?.(el));
    $$('[data-hero-graph]').forEach(mountHeroGraph);
    $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($(b.dataset.copy).textContent.trim()); b.textContent = 'copied'; setTimeout(() => (b.textContent = 'copy'), 1500); } catch (_) { /* clipboard blocked */ }
    }));
    $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('gm-theme', next); } catch (_) { /* storage blocked */ }
    }));
  }
  try { const t = localStorage.getItem('gm-theme'); if (t) document.documentElement.dataset.theme = t; } catch (_) { /* storage blocked */ }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
