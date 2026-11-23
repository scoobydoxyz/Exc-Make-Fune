// Token Radar dashboard (model radar-2). Reads window.RADAR — written beside
// dashboard/ by main.ts as data.js — and renders the ranked board, filters,
// sorting, a per-protocol detail dialog and the live-token view.
// No network: every figure shown comes from the bundled snapshot data.
// Wording rule: protocols are described as "records no token", never as
// having no token — the snapshot record is not proof.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var main = document.querySelector('.shell');
  if (!DATA || !main) {
    if (main) {
      var warn = document.createElement('p');
      warn.className = 'noscript';
      warn.textContent = 'Board data (data.js) did not load, so the ranking cannot be shown.';
      main.appendChild(warn);
    }
    return;
  }

  var model = DATA.model || {};
  var BASE = typeof model.base_multiple === 'number' ? model.base_multiple : 0.25;
  var GROWTH_W = typeof model.growth_weight === 'number' ? model.growth_weight : 0.5;
  var GROWTH_LO = typeof model.growth_floor === 'number' ? model.growth_floor : -60;
  var GROWTH_HI = typeof model.growth_cap === 'number' ? model.growth_cap : 120;
  var MAT_FLOOR = typeof model.maturity_floor === 'number' ? model.maturity_floor : 0.6;
  var MAT_RANGE = typeof model.maturity_range === 'number' ? model.maturity_range : 0.4;
  var MAT_DAYS = typeof model.maturity_days === 'number' ? model.maturity_days : 1095;
  var UNKNOWN_AGE = typeof model.unknown_age_days === 'number' ? model.unknown_age_days : 365;

  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'rank', dir: 1, detail: null };

  var $ = function (id) { return document.getElementById(id); };
  var searchInput = $('q'), catSelect = $('category'), chainSelect = $('chain');
  var tabPre = $('tabPre'), tabLive = $('tabLive'), countEl = $('count');
  var activeEl = $('activeFilters'), headEl = $('boardHead'), bodyEl = $('boardBody');
  var captionEl = $('boardCaption'), emptyEl = $('empty'), dialog = $('detail');

  /* ---------- formatting ---------- */
  var usdFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFull.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(2); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- the model, recomputed here so code and data agree ---------- */
  function growthMultOf(row) {
    var g = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, GROWTH_LO, GROWTH_HI);
    return 1 + (g / 100) * GROWTH_W;
  }
  function maturityMultOf(row) {
    var age = row.age_days === null || row.age_days === undefined ? UNKNOWN_AGE : row.age_days;
    return MAT_FLOOR + (clamp(age, 0, MAT_DAYS) / MAT_DAYS) * MAT_RANGE;
  }
  function chainMultOf(row) {
    var extra = row.chains ? Math.min(Math.max(row.chains.length - 1, 0), 4) : 0;
    return 1 + 0.03 * extra;
  }
  function categoryMultOf(row) {
    return typeof row.category_multiplier === 'number' ? row.category_multiplier : 1;
  }
  function impliedOf(row) {
    var base = row.tvl_usd * BASE;
    var v = base * growthMultOf(row) * maturityMultOf(row) * chainMultOf(row) * categoryMultOf(row);
    return Math.max(1, Math.round(v));
  }
  function multLine(row) {
    return 'g ' + fmtMult(growthMultOf(row)) + ' · m ' + fmtMult(maturityMultOf(row)) +
      ' · ch ' + fmtMult(chainMultOf(row)) + ' · cat ' + fmtMult(categoryMultOf(row));
  }

  /* ---------- small DOM helper (text only, no HTML injection) ---------- */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) {
      // Callers sometimes pass a node as the third argument; append it
      // instead of stringifying it to "[object Object]".
      if (typeof text === 'object') node.appendChild(text);
      else node.textContent = text;
    }
    return node;
  }
  function chainLabel(row) {
    return row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain';
  }
  function catLabel(row) { return row.category || 'Uncategorised'; }

  /* ---------- hash state: #q= #category= #chain= #tab= #detail= ---------- */
  function readHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    var params = new URLSearchParams(raw);
    var q = params.get('q'); if (q !== null) state.q = q;
    var c = params.get('category'); if (c) state.category = c;
    var ch = params.get('chain'); if (ch) state.chain = ch;
    var t = params.get('tab'); if (t === 'live' || t === 'pre-token') state.tab = t;
    var d = params.get('detail'); if (d) state.detail = d;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.detail) params.set('detail', state.detail);
    var next = params.toString();
    var url = next ? '#' + next : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }

  /* ---------- header stats + filter options ---------- */
  function fillStats() {
    $('asOf').textContent = DATA.as_of || '2026-11-14';
    $('sourceName').textContent = DATA.source || 'DefiLlama';
    $('modelVer').textContent = DATA.model_version || 'radar-2';
    $('footModel').textContent = DATA.model_version || 'radar-2';
    $('statWatchlist').textContent = (DATA.watchlist_size || 0) + ' / ' + (DATA.watchlist_size || 0);
    $('statBoard').textContent = String(DATA.board_size || DATA.rows.length);
    $('statEarly').textContent = String(DATA.early_size || 0);
    $('statLive').textContent = String(DATA.live_size || (DATA.live ? DATA.live.length : 0));
    $('statAsOf').textContent = DATA.as_of || '2026-11-14';
  }
  function fillOptions() {
    var cats = {}, chains = {};
    DATA.rows.forEach(function (r) {
      if (r.category) cats[r.category] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    (DATA.live || []).forEach(function (r) {
      if (r.category) cats[r.category] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    function fill(sel, keys, allLabel) {
      sel.textContent = '';
      var all = el('option', null, allLabel); all.value = 'all'; sel.appendChild(all);
      Object.keys(keys).sort().forEach(function (k) {
        var o = el('option', null, k); o.value = k; sel.appendChild(o);
      });
    }
    fill(catSelect, cats, 'All categories');
    fill(chainSelect, chains, 'All chains');
    var hasCat = Object.prototype.hasOwnProperty.call(cats, state.category);
    var hasChain = Object.prototype.hasOwnProperty.call(chains, state.chain);
    catSelect.value = hasCat || state.category === 'all' ? state.category : 'all';
    chainSelect.value = hasChain || state.chain === 'all' ? state.chain : 'all';
    if (catSelect.value !== state.category) state.category = 'all';
    if (chainSelect.value !== state.chain) state.chain = 'all';
  }

  /* ---------- filtering + sorting ---------- */
  function matches(row, q) {
    if (state.category !== 'all' && row.category !== state.category) return false;
    if (state.chain !== 'all' && !(row.chains || []).includes(state.chain)) return false;
    if (!q) return true;
    var hay = [row.name, row.slug, row.category, (row.chains || []).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var list = state.tab === 'pre-token' ? DATA.rows : (DATA.live || []);
    return list.filter(function (r) { return matches(r, q); });
  }
  function sortValue(row, key) {
    if (key === 'name') return row.name.toLowerCase();
    if (key === 'tvl') return row.tvl_usd;
    if (key === 'growth') return row.change_7d === null || row.change_7d === undefined ? -Infinity : row.change_7d;
    if (key === 'age') return row.age_days === null || row.age_days === undefined ? -1 : row.age_days;
    if (key === 'mcap') return row.mcap_usd === null || row.mcap_usd === undefined ? -Infinity : row.mcap_usd;
    if (key === 'implied') return row.implied_value_usd;
    return row.rank === undefined ? 999999 : row.rank;
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av = sortValue(a, key), bv = sortValue(b, key);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  /* ---------- table ---------- */
  function sortHead(key, label) {
    var th = el('th');
    th.setAttribute('scope', 'col');
    var btn = el('button', null, label);
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = (key === 'rank' || key === 'name') ? 1 : -1; }
      render();
    });
    if (state.sort === key) {
      var arrow = el('span', 'arrow', state.dir < 0 ? ' ↓' : ' ↑');
      arrow.setAttribute('aria-hidden', 'true');
      btn.appendChild(arrow);
      btn.setAttribute('aria-sort', state.dir < 0 ? 'descending' : 'ascending');
    }
    th.appendChild(btn);
    return th;
  }
  function plainHead(label) {
    var th = el('th', null, label);
    th.setAttribute('scope', 'col');
    return th;
  }
  function nameCell(row) {
    var td = el('td', 'name-cell');
    td.appendChild(el('b', null, row.name));
    td.appendChild(el('span', 'sub', catLabel(row) + ' · ' + chainLabel(row)));
    return td;
  }
  function growthCell(row) {
    var td = el('td', 'num');
    td.textContent = fmtPct(row.change_7d);
    if (row.change_7d !== null && row.change_7d !== undefined) td.classList.add(row.change_7d >= 0 ? 'pos' : 'neg');
    return td;
  }
  function openRow(row) { openDetail(row.slug); }

  function renderHead() {
    headEl.textContent = '';
    var tr = el('tr');
    if (state.tab === 'pre-token') {
      tr.appendChild(sortHead('rank', 'Rank'));
      tr.appendChild(sortHead('name', 'Protocol'));
      tr.appendChild(plainHead('Category'));
      tr.appendChild(plainHead('Chains'));
      tr.appendChild(sortHead('tvl', 'TVL'));
      tr.appendChild(sortHead('growth', '7d'));
      tr.appendChild(sortHead('age', 'Age'));
      tr.appendChild(sortHead('implied', 'Implied value'));
      tr.appendChild(plainHead('Token'));
    } else {
      tr.appendChild(plainHead('Status'));
      tr.appendChild(sortHead('name', 'Protocol'));
      tr.appendChild(plainHead('Category'));
      tr.appendChild(plainHead('Chains'));
      tr.appendChild(sortHead('tvl', 'TVL'));
      tr.appendChild(sortHead('growth', '7d'));
      tr.appendChild(sortHead('mcap', 'Market cap'));
      tr.appendChild(plainHead('Token'));
    }
    headEl.appendChild(tr);
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    renderHead();
    bodyEl.textContent = '';
    var pre = state.tab === 'pre-token';
    captionEl.textContent = pre
      ? 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.'
      : 'Live-token protocols set aside: their market cap is a fact, not a model. They are not ranked here.';
    emptyEl.hidden = list.length !== 0;
    if (pre) {
      var max = 1;
      DATA.rows.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
      list.forEach(function (r) {
        var tr = el('tr');
        tr.setAttribute('data-slug', r.slug);
        tr.setAttribute('data-selected', state.detail === r.slug ? 'true' : 'false');
        tr.tabIndex = 0;
        tr.addEventListener('click', function () { openRow(r); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(r); }
        });
        tr.appendChild(el('td', 'num', String(r.rank)));
        tr.appendChild(nameCell(r));
        tr.appendChild(el('td', null, catLabel(r)));
        var chainsTd = el('td');
        (r.chains || []).slice(0, 3).forEach(function (c) { chainsTd.appendChild(el('span', 'chip', c)); });
        if ((r.chains || []).length > 3) chainsTd.appendChild(el('span', 'sub', ' +' + (r.chains.length - 3)));
        tr.appendChild(chainsTd);
        tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
        tr.appendChild(growthCell(r));
        tr.appendChild(el('td', 'num', fmtAge(r.age_days)));
        var impTd = el('td', 'implied-cell');
        var top = el('div', 'implied-top');
        var bar = el('div', 'bar'); bar.setAttribute('aria-hidden', 'true');
        var fill = el('i'); fill.style.width = Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%';
        bar.appendChild(fill);
        top.appendChild(bar);
        top.appendChild(el('span', 'num', fmtUsd(r.implied_value_usd)));
        impTd.appendChild(top);
        impTd.appendChild(el('div', 'mult-line', multLine(r)));
        tr.appendChild(impTd);
        tr.appendChild(el('td', null, el('span', 'status', 'records no token')));
        bodyEl.appendChild(tr);
      });
    } else {
      list.forEach(function (r) {
        var tr = el('tr');
        tr.setAttribute('data-slug', r.slug);
        tr.tabIndex = 0;
        tr.addEventListener('click', function () { openRow(r); });
        tr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(r); }
        });
        tr.appendChild(el('td', null, el('span', 'status live', 'already trades')));
        tr.appendChild(nameCell(r));
        tr.appendChild(el('td', null, catLabel(r)));
        tr.appendChild(el('td', null, chainLabel(r)));
        tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
        tr.appendChild(growthCell(r));
        tr.appendChild(el('td', 'num', fmtUsd(r.mcap_usd)));
        tr.appendChild(el('td', null, el('span', 'status live', 'token live')));
        bodyEl.appendChild(tr);
      });
    }
    var total = pre ? DATA.rows.length : (DATA.live || []).length;
    countEl.textContent = list.length + ' of ' + total + ' shown';
    renderActiveFilters(list.length, total);
  }

  function renderActiveFilters(shown, total) {
    var parts = [];
    if (state.q) parts.push('search “' + state.q + '”');
    if (state.category !== 'all') parts.push('category ' + state.category);
    if (state.chain !== 'all') parts.push('chain ' + state.chain);
    parts.push(state.tab === 'pre-token' ? 'pre-token tab' : 'live-token tab');
    activeEl.textContent = '';
    activeEl.appendChild(el('span', null, 'Showing ' + shown + ' of ' + total + ' · Filters active: '));
    activeEl.appendChild(el('b', null, parts.join(' · ')));
  }

  /* ---------- detail dialog ---------- */
  function findRow(slug) {
    var hit = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) hit = r; });
    if (hit) return { row: hit, live: false };
    (DATA.live || []).forEach(function (r) { if (r.slug === slug) hit = r; });
    return hit ? { row: hit, live: true } : null;
  }
  function eqRow(label, value) {
    var div = el('div');
    div.appendChild(el('span', null, label));
    div.appendChild(el('b', 'num', value));
    return div;
  }
  function splitStep(step) {
    var at = step.indexOf(' Cost: ');
    if (at < 0) return { action: step, tail: '' };
    return { action: step.slice(0, at), tail: step.slice(at + 1) };
  }
  function section(title) {
    var s = el('section', 'detail-section');
    s.appendChild(el('h3', null, title));
    return s;
  }
  function openDetail(slug) {
    var found = findRow(slug);
    if (!found) return;
    var row = found.row;
    state.detail = slug;
    writeHash();
    dialog.textContent = '';
    var inner = el('div', 'detail-inner');
    var head = el('div', 'detail-head');
    var headText = el('div');
    headText.appendChild(el('span', 'brand-name', found.live ? 'LIVE TOKEN — NOT RANKED' : 'RANK ' + row.rank + ' OF ' + DATA.rows.length));
    var title = el('h2', null, row.name);
    title.id = 'detailTitle';
    headText.appendChild(title);
    headText.appendChild(el('p', 'sub', catLabel(row) + ' on ' + chainLabel(row)));
    var close = el('button', 'close', 'Close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close details');
    close.addEventListener('click', function () { dialog.close(); });
    head.appendChild(headText);
    head.appendChild(close);
    inner.appendChild(head);

    if (!found.live) {
      var recomputed = impliedOf(row);
      var base = row.tvl_usd * BASE;
      var sec = section('Implied value — model breakdown');
      var eq = el('div', 'equation');
      eq.appendChild(eqRow('TVL', fmtUsd(row.tvl_usd)));
      eq.appendChild(eqRow('Base (TVL × ' + BASE + ')', fmtUsd(base)));
      eq.appendChild(eqRow('Seven-day growth', fmtPct(row.change_7d)));
      eq.appendChild(eqRow('Growth multiplier', fmtMult(growthMultOf(row))));
      eq.appendChild(eqRow('Age', fmtAge(row.age_days)));
      eq.appendChild(eqRow('Maturity multiplier', fmtMult(maturityMultOf(row))));
      eq.appendChild(eqRow('Chains (' + (row.chains || []).length + ')', fmtMult(chainMultOf(row))));
      eq.appendChild(eqRow('Category multiplier', fmtMult(categoryMultOf(row))));
      var total = el('div', 'total');
      total.appendChild(el('span', null, 'Implied value (board)'));
      total.appendChild(el('b', 'num', fmtUsd(row.implied_value_usd)));
      eq.appendChild(total);
      sec.appendChild(eq);
      var match = el('p', 'match', 'Recomputed here: ' + fmtUsd(recomputed) + ' — ' +
        (recomputed === row.implied_value_usd
          ? 'matches the board figure. Code and data agree.'
          : 'does NOT match the board figure (' + fmtUsd(row.implied_value_usd) + '); treat the board figure as stale.'));
      match.classList.add(recomputed === row.implied_value_usd ? 'ok' : 'bad');
      sec.appendChild(match);
      inner.appendChild(sec);

      var farm = section('Farm plan — ' + (row.farm_steps ? row.farm_steps.length : 0) + ' steps');
      var ol = el('ol', 'steps');
      (row.farm_steps || []).forEach(function (s) {
        var parts = splitStep(s);
        var li = el('li');
        li.appendChild(el('b', null, parts.action));
        if (parts.tail) li.appendChild(el('span', 'cost', parts.tail));
        ol.appendChild(li);
      });
      farm.appendChild(ol);
      inner.appendChild(farm);

      var note = el('p', 'token-note', 'This protocol records no token in the snapshot (as of ' + (DATA.as_of || '2026-11-14') + ', source ' + (DATA.source || 'DefiLlama') + ').');
      inner.appendChild(note);
    } else {
      var mkt = section('Market figures — not a model');
      var eq2 = el('div', 'equation');
      eq2.appendChild(eqRow('TVL', fmtUsd(row.tvl_usd)));
      eq2.appendChild(eqRow('Market cap', fmtUsd(row.mcap_usd)));
      eq2.appendChild(eqRow('Seven-day growth', fmtPct(row.change_7d)));
      mkt.appendChild(eq2);
      mkt.appendChild(el('p', 'match', 'This protocol already trades, so its market cap is shown instead of an implied value. It is set aside from the pre-token ranking.'));
      inner.appendChild(mkt);
      inner.appendChild(el('p', 'token-note live', 'Token already trades — no farm plan is ranked for this protocol.'));
    }
    dialog.appendChild(inner);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    renderBoardSelection();
  }
  function renderBoardSelection() {
    var prev = bodyEl.querySelector('tr[data-selected="true"]');
    if (prev) prev.setAttribute('data-selected', 'false');
    if (!state.detail) return;
    var sel = bodyEl.querySelector('tr[data-slug="' + state.detail + '"]');
    if (sel) sel.setAttribute('data-selected', 'true');
  }
  dialog.addEventListener('close', function () {
    if (state.detail) { state.detail = null; writeHash(); renderBoard(); }
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- wiring ---------- */
  function render() {
    renderBoard();
  }
  searchInput.addEventListener('input', function () { state.q = searchInput.value; writeHash(); render(); });
  catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
  chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
  function setTab(tab) {
    state.tab = tab;
    tabPre.setAttribute('aria-pressed', tab === 'pre-token' ? 'true' : 'false');
    tabLive.setAttribute('aria-pressed', tab === 'live' ? 'true' : 'false');
    if (tab === 'live') { state.sort = 'mcap'; state.dir = -1; }
    else { state.sort = 'rank'; state.dir = 1; }
    writeHash();
    render();
  }
  tabPre.addEventListener('click', function () { setTab('pre-token'); });
  tabLive.addEventListener('click', function () { setTab('live'); });
  $('clearFilters').addEventListener('click', function () {
    state.q = ''; state.category = 'all'; state.chain = 'all';
    searchInput.value = ''; catSelect.value = 'all'; chainSelect.value = 'all';
    writeHash(); render();
  });
  window.addEventListener('hashchange', function () {
    var keepDetail = state.detail;
    readHash();
    searchInput.value = state.q;
    catSelect.value = state.category;
    chainSelect.value = state.chain;
    tabPre.setAttribute('aria-pressed', state.tab === 'pre-token' ? 'true' : 'false');
    tabLive.setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
    render();
    if (state.detail && state.detail !== keepDetail) openDetail(state.detail);
  });

  readHash();
  fillStats();
  fillOptions();
  searchInput.value = state.q;
  tabPre.setAttribute('aria-pressed', state.tab === 'pre-token' ? 'true' : 'false');
  tabLive.setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
  if (state.tab === 'live') { state.sort = 'mcap'; state.dir = -1; }
  render();
  if (state.detail) openDetail(state.detail);
})();
