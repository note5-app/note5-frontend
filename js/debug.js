// NOTE5 — Debug overlay completo. Sin Eruda. Sin dependencias.
// Incluye: panel de logs + consola interactiva + captura de errores.


  (function () {
  'use strict';

  const MAX_LINES = 500;
  const HISTORY_KEY = 'note5.dbg.history';
  const ENABLED_KEY = 'note5.dbg.enabled';

  // ---------- Decisión: on/off ----------
  const params = new URLSearchParams(location.search);
  const flag = params.get('debug');
  let enabled;
  if (flag === '1') { enabled = true; localStorage.setItem(ENABLED_KEY, '1'); }
  else if (flag === '0') { enabled = false; localStorage.removeItem(ENABLED_KEY); }
  else enabled = localStorage.getItem(ENABLED_KEY) === '1';

  if (!enabled) return;

  const state = {
    body: null, counts: null, panel: null, tab: null, input: null,
    counter: { log: 0, warn: 0, error: 0, net: 0 },
    history: [], historyIdx: -1,
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });

  function mount() {
    if (document.getElementById('__dbg_panel')) return;
    try { state.history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch {}
    buildUI();
    hookConsole();
    hookErrors();
    hookWorker();
    hookNetwork();
    hookTimers();
    push('log', ['[debug] ready — ' + location.href]);
    push('log', ['[debug] UA: ' + navigator.userAgent]);
    push('log', ['[debug] type JS below and press Enter. up/down arrows = history.']);
    push('log', ['[debug] disable: ?debug=0 or the "disable" button.']);
  }


  // ---------- UI ----------
  function buildUI() {
    const style = document.createElement('style');
    style.textContent = `
      #__dbg_panel {
        position: fixed; left: 0; right: 0; bottom: 0; height: 55vh;
        background: #0a0f14; color: #d8dee6;
        font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace;
        z-index: 2147483647;
        display: flex; flex-direction: column;
        border-top: 2px solid #5b9bd5;
        box-shadow: 0 -6px 24px rgba(0,0,0,0.7);
      }
      #__dbg_panel.hidden { display: none; }
      #__dbg_hdr {
        display: flex; gap: 6px; align-items: center;
        padding: 6px 8px; background: #17212b;
        border-bottom: 1px solid #223240; flex-shrink: 0;
      }
      #__dbg_hdr .title { flex: 1; color: #f2f5f8; font-weight: 600; }
      #__dbg_hdr .counts { color: #7f93a3; font-size: 10px; }
      #__dbg_hdr button {
        background: #223240; color: #d8dee6; border: 0;
        padding: 5px 9px; border-radius: 4px; font: inherit;
      }
      #__dbg_hdr button:active { background: #5b9bd5; color: #0b1116; }
      #__dbg_body {
        flex: 1; overflow-y: auto; padding: 4px 8px;
        -webkit-overflow-scrolling: touch;
      }
      #__dbg_body .line {
        padding: 3px 0; white-space: pre-wrap; word-break: break-word;
        border-bottom: 1px dashed rgba(127,147,163,0.10);
      }
      #__dbg_body .line .t { color: #55677a; margin-right: 6px; }
      #__dbg_body .line.log   { color: #d8dee6; }
      #__dbg_body .line.warn  { color: #d9b06b; }
      #__dbg_body .line.error { color: #ff8080; background: rgba(217,112,112,0.08); }
      #__dbg_body .line.net   { color: #7fbfa0; }
      #__dbg_body .line.in    { color: #5b9bd5; }
      #__dbg_body .line.out   { color: #b8c4d0; }
      #__dbg_input_row {
        display: flex; gap: 6px; padding: 6px 8px;
        background: #17212b; border-top: 1px solid #223240;
        flex-shrink: 0; align-items: center;
      }
      #__dbg_input_row .prompt { color: #5b9bd5; font-weight: 600; }
      #__dbg_input {
        flex: 1; background: #0a0f14; color: #d8dee6;
        border: 1px solid #223240; border-radius: 4px;
        padding: 8px 10px; font: inherit; outline: none;
      }
      #__dbg_input:focus { border-color: #5b9bd5; }
      #__dbg_run {
        background: #5b9bd5; color: #0b1116; border: 0;
        padding: 8px 12px; border-radius: 4px; font: inherit; font-weight: 600;
      }
      #__dbg_tab {
        position: fixed; left: 8px; bottom: 8px;
        background: #5b9bd5; color: #0b1116;
        padding: 10px 14px; border-radius: 999px;
        font: 600 13px ui-monospace, monospace;
        z-index: 2147483646; box-shadow: 0 2px 12px rgba(0,0,0,0.6);
        display: none; cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = '__dbg_panel';
    panel.innerHTML = `
      <div id="__dbg_hdr">
        <div class="title">NOTE5 · debug</div>
        <div class="counts" id="__dbg_counts">0e 0w 0l 0n</div>
        <button id="__dbg_clear">clear</button>
        <button id="__dbg_disable">disable</button>
        <button id="__dbg_hide">hide</button>
      </div>
      <div id="__dbg_body"></div>
      <div id="__dbg_input_row">
        <span class="prompt">&gt;</span>
        <input id="__dbg_input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="JavaScript...">
        <button id="__dbg_run">Run</button>
      </div>
    `;
    const tab = document.createElement('div');
    tab.id = '__dbg_tab';
    tab.textContent = '🐛';
    tab.onclick = () => toggle(true);

    document.body.append(panel, tab);

    state.panel = panel;
    state.body = panel.querySelector('#__dbg_body');
    state.counts = panel.querySelector('#__dbg_counts');
    state.tab = tab;
    state.input = panel.querySelector('#__dbg_input');

    panel.querySelector('#__dbg_clear').onclick = clear;
    panel.querySelector('#__dbg_disable').onclick = () => {
      localStorage.removeItem(ENABLED_KEY);
      location.reload();
    };
    panel.querySelector('#__dbg_hide').onclick = () => toggle(false);
    panel.querySelector('#__dbg_run').onclick = executeInput;

    state.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); executeInput(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); navHistory(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); navHistory(1); }
    });
  }

  function toggle(show) {
    state.panel.classList.toggle('hidden', !show);
    state.tab.style.display = show ? 'none' : 'block';
  }

  function clear() {
    state.body.innerHTML = '';
    state.counter = { log: 0, warn: 0, error: 0, net: 0 };
    refreshCounts();
  }

  function refreshCounts() {
    state.counts.textContent =
      `${state.counter.error}e ${state.counter.warn}w ${state.counter.log}l ${state.counter.net}n`;
  }

  function push(kind, args) {
    const text = args.map(serialize).join(' ');
    if (!state.body) { console.log('[dbg-buffer]', kind, text); return; }
    state.counter[kind] = (state.counter[kind] || 0) + 1;
    const line = document.createElement('div');
    line.className = 'line ' + kind;
    const t = new Date().toISOString().slice(11, 23);
    line.innerHTML = `<span class="t">${t}</span>${escapeHtml(text)}`;
    state.body.appendChild(line);
    while (state.body.children.length > MAX_LINES) state.body.firstChild.remove();
    state.body.scrollTop = state.body.scrollHeight;
    refreshCounts();
  }

  function serialize(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
    if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
    if (v instanceof Error) return `${v.name}: ${v.message}` + (v.stack ? '\n' + v.stack : '');
    if (v instanceof Uint8Array) return `Uint8Array(${v.byteLength})[${Array.from(v.slice(0,16)).join(',')}${v.byteLength > 16 ? '…' : ''}]`;
    if (v instanceof ArrayBuffer) return `ArrayBuffer(${v.byteLength})`;
    if (typeof Promise !== 'undefined' && v instanceof Promise) return '[Promise]';
    if (typeof Element !== 'undefined' && v instanceof Element) return `<${v.tagName.toLowerCase()}${v.id ? '#' + v.id : ''}>`;
    try {
      const seen = new WeakSet();
      const s = JSON.stringify(v, (k, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      });
      return s.length > 3000 ? s.slice(0, 3000) + '…' : s;
    } catch { return String(v); }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  // ---------- Interactive console ----------
  function executeInput() {
    const code = state.input.value.trim();
    if (!code) return;
    state.input.value = '';
    push('in', ['> ' + code]);

    state.history = [code, ...state.history.filter(h => h !== code)].slice(0, 100);
    state.historyIdx = -1;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); } catch {}

    // Ejecutamos envuelto para soportar tanto expresiones como sentencias.
    // Si es una expresión, devolvemos su valor. Si es código, se ejecuta.
    runCode(code);
  }

  async function runCode(code) {
    try {
      // Intentamos como expresión primero: (async () => { return eval(...) })()
      // Si falla la sintaxis, caemos a ejecución como bloque.
      let result;
      try {
        // new Function permite return + top-level await dentro de un async wrapper
        const fn = new Function(`return (async () => { return (${code}); })()`);
        result = await fn.call(window);
      } catch (syntaxErr) {
        // Falló como expresión (probablemente sentencias). Ejecutamos como bloque.
        const fn = new Function(`return (async () => { ${code} })()`);
        result = await fn.call(window);
      }
      if (result !== undefined) push('out', [result]);
    } catch (err) {
      push('error', ['[console]', err]);
    }
  }

  function navHistory(dir) {
    if (!state.history.length) return;
    if (dir === -1) state.historyIdx = Math.min(state.historyIdx + 1, state.history.length - 1);
    else state.historyIdx = Math.max(state.historyIdx - 1, -1);
    state.input.value = state.historyIdx >= 0 ? state.history[state.historyIdx] : '';
    // Mueve el cursor al final
    requestAnimationFrame(() => {
      const len = state.input.value.length;
      state.input.setSelectionRange(len, len);
    });
  }

  // ---------- Hooks ----------
  function hookConsole() {
    const orig = {};
    for (const name of ['log', 'warn', 'error', 'info', 'debug']) {
      orig[name] = console[name].bind(console);
      console[name] = (...args) => {
        try { orig[name](...args); } catch {}
        const kind = name === 'error' ? 'error' : name === 'warn' ? 'warn' : 'log';
        push(kind, args);
      };
    }
  }

  function hookErrors() {
    window.addEventListener('error', (e) => {
      if (e.message === 'Script error.' && !e.filename) return;
      push('error', ['[window.error]', e.message, `${e.filename}:${e.lineno}:${e.colno}`]);
    });
    window.addEventListener('unhandledrejection', (e) => {
      push('error', ['[unhandledrejection]', e.reason]);
    });
  }

  function hookWorker() {
    const OriginalWorker = window.Worker;
    if (!OriginalWorker) return;
    window.Worker = function (...args) {
      push('log', [`[worker] new Worker(${String(args[0]).split('/').pop()})`]);
      const w = new OriginalWorker(...args);
      w.addEventListener('error', (e) => {
        push('error', [`[worker.error] ${e.message || '(no message)'}`,
                       `at ${e.filename || '?'}:${e.lineno || '?'}`]);
      });
      w.addEventListener('messageerror', (e) => {
        push('error', ['[worker.messageerror]', e.data]);
      });
      w.addEventListener('message', (e) => {
        const m = e.data;
        if (!m || typeof m !== 'object') return;
        if (m.type === 'progress') return;
        if (m.type === 'worker_error') {
          push('error', ['[worker]', m.error?.message || 'worker_error', m.error?.stack || '']);
        }
      });
      return w;
    };
    window.Worker.prototype = OriginalWorker.prototype;
  }

  function hookNetwork() {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '(?)');
      const method = (args[1]?.method || 'GET').toUpperCase();
      const t0 = performance.now();
      try {
        const res = await origFetch.apply(this, args);
        push('net', [`${method} ${shorten(url)} → ${res.status} (${(performance.now() - t0).toFixed(0)}ms)`]);
        return res;
      } catch (err) {
        push('error', [`${method} ${shorten(url)} → FAILED`, err.message]);
        throw err;
      }
    };
  }

  function hookTimers() {
    const origST = window.setTimeout;
    window.setTimeout = function (fn, ...rest) {
      if (typeof fn !== 'function') return origST(fn, ...rest);
      return origST(function () {
        try { fn.apply(this, arguments); }
        catch (err) { push('error', ['[setTimeout]', err]); throw err; }
      }, ...rest);
    };
    const origSI = window.setInterval;
    window.setInterval = function (fn, ...rest) {
      if (typeof fn !== 'function') return origSI(fn, ...rest);
      return origSI(function () {
        try { fn.apply(this, arguments); }
        catch (err) { push('error', ['[setInterval]', err]); throw err; }
      }, ...rest);
    };
  }

  function shorten(url) {
    try {
      const u = new URL(url, location.href);
      return u.pathname + (u.search ? u.search.slice(0, 40) : '');
    } catch { return url; }
  }

  // ---------- API pública ----------
  window.__note5debug = { push, clear, hide: () => toggle(false), show: () => toggle(true) };
  window.dbg  = (...args) => push('log', args);
  window.dbgw = (...args) => push('warn', args);
  window.dbge = (...args) => push('error', args);
  window.dbgc = clear;
})();
