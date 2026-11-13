// Copies the single-threaded "lite" Stockfish build from node_modules into public/stockfish/.
// It works on any static host with no special server settings.
import fs from 'node:fs';
import path from 'node:path';

const pkg = path.resolve('node_modules', 'stockfish');
if (!fs.existsSync(pkg)) { console.warn('[stockfish] package not installed yet, skipping copy'); process.exit(0); }

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const js = walk(pkg).find((f) => /lite-single\.js$/.test(f) && fs.existsSync(f.replace(/\.js$/, '.wasm')));
if (!js) { console.warn('[stockfish] could not find the lite single-threaded files; the app will use the built-in engine'); process.exit(0); }

const base = path.basename(js, '.js');
const out = path.resolve('public', 'stockfish');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(js, path.join(out, base + '.js'));
fs.copyFileSync(js.replace(/\.js$/, '.wasm'), path.join(out, base + '.wasm'));
fs.writeFileSync(path.join(out, 'engine.json'), JSON.stringify({ script: base + '.js' }));
console.log('[stockfish] copied', base);
