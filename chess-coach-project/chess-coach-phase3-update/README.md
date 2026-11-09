# Chess Coach

A chess app with a built-in engine, post-game review, tutor and live-coach modes, and a Claude-powered coach.
This is the same app that was running as a single page on claude.ai, split into a proper project.

## Run it on your computer

1. Install Node.js (LTS) from nodejs.org.
2. Open a terminal in this folder and run:

```
npm install
npm run dev
```

3. Open the address it prints (usually http://localhost:5173).

To build the files for hosting: `npm run build` (output goes in `dist/`).

## Project layout

| File | What it holds |
|---|---|
| `index.html` | Page structure |
| `src/style.css` | All styling |
| `src/engine.js` | The built-in chess engine (search, strength levels, win-chance formula). Stockfish will replace or sit beside this |
| `src/board.js` | Draws the board, pieces, check and checkmate highlights |
| `src/claude.js` | The only place that talks to Claude (coach and tutor explanations) |
| `src/chessLib.js` | Imports the chess.js rules library |
| `src/main.js` | Game flow, play modes, review, tutor, coach panel |

## Known differences from the claude.ai version

- **The Coach and tutor explanations will not work yet.** On claude.ai they use a built-in connection to Claude. On your own site that needs a small backend and an Anthropic API key (see `src/claude.js`). Everything else, including move checking, tutor interruptions and win-chance numbers, works without it.
- Saved games use your browser's local storage, so they stay on one device.

## Next steps

1. Confirm it runs and plays like the claude.ai version.
2. Add Stockfish (WebAssembly build) behind an engine module, then point levels, review and tutor at it.
3. Add the Claude backend for the coach.
4. Deploy with Netlify or Vercel (`netlify.toml` is already included).

## Licensing note

Stockfish is licensed under the GPL. If you publish an app that includes it, your own code generally needs to be open source too. Check this before releasing or selling the app.

## Stockfish (Phase 3)

- `npm install` downloads the `stockfish` package and a script (`scripts/copy-stockfish.mjs`) copies the single-threaded lite engine into `public/stockfish/`. That folder is generated, so it is not committed.
- `src/stockfish.js` talks to the engine over the UCI protocol in a Web Worker.
- The level menu now has three Stockfish options: about 1500, about 2200 and full strength. Ratings are approximate.
- If Stockfish cannot load, the app says so and uses the built-in engine.
- Review, tutor mode and win-chance numbers still use the built-in engine. Switching them to Stockfish is the next phase.
