// UCI wrapper around Stockfish running in a Web Worker.
// The engine files are copied into public/stockfish/ by scripts/copy-stockfish.mjs
// (runs automatically after `npm install`).
const BASE = import.meta.env.BASE_URL;
let worker = null, readyP = null, chain = Promise.resolve();
const post = (c) => worker.postMessage(c);

// Strength presets used by the level menu. elo = null means full strength.
// UCI_Elo ratings are approximate and not the same scale as chess.com or Lichess.
export const SF_LEVELS = {
  5: { elo: 1500, movetime: 700 },
  6: { elo: 2200, movetime: 1000 },
  7: { elo: null, movetime: 2000 },
};

function waitFor(test, ms, what) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(what + ' timed out')), ms);
    worker.onmessage = (e) => { const l = String(e.data); if (test(l)) { clearTimeout(t); res(l); } };
    worker.onerror = () => { clearTimeout(t); rej(new Error('engine worker error')); };
  });
}

export function sfInit() {
  if (!readyP) {
    readyP = (async () => {
      const resp = await fetch(BASE + 'stockfish/engine.json');
      let meta;
      try { meta = JSON.parse(await resp.text()); }
      catch { throw new Error('engine files not found - run npm install again'); }
      worker = new Worker(BASE + 'stockfish/' + meta.script);
      const u = waitFor((l) => l.includes('uciok'), 20000, 'Stockfish start');
      post('uci'); await u;
      post('setoption name Threads value 1');
      post('setoption name Hash value 32');
      const r = waitFor((l) => l.includes('readyok'), 10000, 'Stockfish ready');
      post('isready'); await r;
    })();
    readyP.catch(() => { readyP = null; }); // allow a retry after a failure
  }
  return readyP;
}

// Search one position. Score s is in centipawns from the side to move's view
// (mates are +/-30000 minus the distance), matching the built-in engine.
export function sfSearch(fen, { movetime = 800, elo = null } = {}) {
  const run = async () => {
    await sfInit();
    post('setoption name UCI_LimitStrength value ' + (elo ? 'true' : 'false'));
    if (elo) post('setoption name UCI_Elo value ' + elo);
    post('position fen ' + fen);
    let last = { s: 0 };
    const done = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('search timed out')), movetime + 15000);
      worker.onmessage = (e) => {
        const l = String(e.data);
        if (l.startsWith('info') && / score /.test(l) && !/bound/.test(l)) {
          const m = l.match(/score (cp|mate) (-?\d+)/);
          if (m) { const v = +m[2]; last = { s: m[1] === 'cp' ? v : v > 0 ? 30000 - v : -30000 - v }; }
        } else if (l.startsWith('bestmove')) { clearTimeout(t); res({ uci: l.split(' ')[1], s: last.s }); }
      };
      worker.onerror = () => { clearTimeout(t); rej(new Error('engine worker error')); };
    });
    post('go movetime ' + movetime);
    return done;
  };
  const p = chain.then(run, run); // one search at a time
  chain = p.catch(() => {});
  return p;
}

// Same result shape as root() in engine.js: { m: chess.js move, s: score }
export async function sfRoot(g, opts) {
  const r = await sfSearch(g.fen(), opts);
  if (!r.uci || r.uci === '(none)') return { m: null, s: r.s };
  const m = g.moves({ verbose: true }).find((x) => x.from + x.to + (x.promotion || '') === r.uci);
  return { m: m || null, s: r.s };
}
