// Usage: node build-js.js <in.jsx> <out.js> [coach-pathway.json]
// Compiles the portal interface. The coaching pathway (levels, names, renames,
// requirements and evaluation tasks) is inlined from coach-pathway.json, the
// same file the plugin ships in data/ and loads on the server.
const ts = require('typescript'); const fs = require('fs');
let src = fs.readFileSync(process.argv[2], 'utf8');
if (process.argv[4]) {
  const pathway = JSON.stringify(JSON.parse(fs.readFileSync(process.argv[4], 'utf8')));
  if (!src.includes('/*@COACH_PATHWAY@*/null')) { console.error('ERR pathway placeholder not found'); process.exit(1); }
  src = src.replace('/*@COACH_PATHWAY@*/null', () => pathway);
}
const out = ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None } });
const errs = (out.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
errs.slice(0, 10).forEach(d => { const p = d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: -1 }; console.error('ERR', p.line + 1, ts.flattenDiagnosticMessageText(d.messageText, '\n')); });
if (errs.length) process.exit(1);
fs.writeFileSync(process.argv[3], out.outputText.replace(/^"use strict";\s*/, ''));
console.log('compiled', process.argv[3], Math.round(out.outputText.length / 1024) + ' KB');
