// Usage: node make-seed.js <compiled portal-app.js> <out.json>  (npm run seed)
// Runs the compiled portal code with stub browser globals and writes makeSeed() as the plugin's demo seed.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8').replace(/ReactDOM\.createRoot\([\s\S]*?\.render\([\s\S]*$/, '');
const noop = () => {}; const stub = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub, apply: () => stub, construct: () => stub });
const store = {};
const ctx = { console, structuredClone, Math, Date, JSON, Intl, URL, setTimeout, clearTimeout, Promise,
  React: { createContext: () => ({}), useState: noop, useEffect: noop, useMemo: noop, useRef: noop, useCallback: noop, useContext: noop, createElement: noop, Fragment: 'f' },
  ReactDOM: stub, document: stub, navigator: { language: 'en' }, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: noop }, MutationObserver: function () {}, matchMedia: () => ({ matches: false, addEventListener: noop }) };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__seed = makeSeed();', ctx);
const s = ctx.__seed;
(s.users || []).forEach(u => { delete u.password; });
fs.writeFileSync(process.argv[3], JSON.stringify(s));
console.log('seed version', s.version, 'keys', Object.keys(s).length);
