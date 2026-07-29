# Endless Runner Template for RUN.game

Build your own 2D endless runner, fast. This template is a complete, playable runner — tap-to-jump physics that already feel good, obstacles, pickups, a parallax world, a coin economy with a cosmetics shop, rewarded ads, music and sound, settings, and persistence — all wired to the RUN.game platform (Pixi.js v8 + React 19 + Tailwind v4 + the RundotGameAPI SDK).

Everything you see is a placeholder for YOUR game: the art and audio are generated procedurally at runtime (zero assets), so the template runs immediately, and every sprite and sound has a documented swap point for your own content. The Can't Stop Now Jam Kit's `example-games/endless-runner` folder shows one finished game (One More Run) built from exactly this starting point.

## What You Get

- **A runner that feels right out of the box**: variable-height jump, double jump, coyote time, jump buffering, landing assist, squash & stretch, particles, speed ramp, fair speed-scaled spawning
- **Walkable platforms**: obstacles flagged `safeTop` can be landed on and ran across; sides stay deadly
- **Meta loop**: coin wallet → cosmetics shop (example skin catalog, easily replaced or deleted) → equipped cosmetic appears in-game
- **Platform integration, done**: per-player saves (with local fallback for dev), an all-time leaderboard with a dedicated leaderboard screen (auto-created on deploy), rewarded-ad coin doubling under a tamper-proof 15/day cap, analytics events, haptics, host lifecycle handling, quit confirmation
- **Audio**: synthesized music loop + SFX on music/sound buses with a settings screen; swap in real files without touching call sites
- **Art pipeline**: drop a PNG in `public/images/`, list it in the manifest under a known alias, and it replaces the placeholder — one sprite at a time

## Quick Start

```bash
npm install
npm run dev            # http://localhost:5173 — playable immediately
```

## Make It Yours (the intended path)

1. **Feel**: tune `src/game/config.ts` — physics, speed ramp, spawn pacing, obstacle mix. Everything is data.
2. **World + character**: change the palette in `config.ts` colors and `src/styles/app.css`, redraw placeholders in `src/game/textures.ts`, or swap in real art via `src/assets/manifest.ts` (art spec in CLAUDE.md).
3. **Content**: replace the example obstacle archetypes (`config.ts`) and the example skin catalog (`src/game/skins.ts`) with your own — or delete the shop entirely.
4. **Identity**: title in `index.html`, `src/ui/MainMenu.tsx`, `src/ui/LoadingScreen.tsx`; save key in `src/state/save.ts`; package name.
5. **Audio**: retune the synth song data in `src/audio/audio.ts` or swap in real files (notes at the top of that file).
6. **More systems**: daily rewards, IAP shop, quests, tutorial and more are available as copy-in modules from the [`@series-inc/run-game-helpers`](https://www.npmjs.com/package/@series-inc/run-game-helpers) npm package — the ads system here came from it.

Search the source for `ADAPT:` for every intended edit point. UI copy rules (why text sizes and punctuation look the way they do) are in CLAUDE.md.

## Deploy to RUN.game

Needs the [RUN.game CLI](https://github.com/series-ai/rundot-cli-releases).

```bash
rundot login
rundot init --name <your-game> --description "<desc>" --build-path dist --orientation Portrait
npm run build
rundot deploy
```

`rundot init` runs ONCE per game (it registers the game and writes the config into `rundot/`); after that, iterating is just `npm run build && rundot deploy`. Deploys are **private by default** — playable by you via your profile / `rundot list-games`, but not listed on the Explore page until you deploy with `--public`.

Before your first deploy, replace `public/thumbnail.jpg` with your game's tile art — **exactly 512×512, JPG**.

## Where Things Live

```
src/game/config.ts        // every gameplay tunable (start here)
src/game/runnerScene.ts   // the run: orchestration, input, scoring, death flow
src/game/player.ts        // jump physics + game feel
src/game/obstacles.ts     // obstacle/coin spawning + collision
src/game/background.ts    // parallax layers
src/game/textures.ts      // art slots: real art via manifest, procedural fallback
src/game/skins.ts         // EXAMPLE cosmetics catalog (replace or delete)
src/audio/audio.ts        // music + sfx buses (synth now, files later)
src/state/                // store (UI state), save (persistence)
src/sdk/leaderboard.ts    // all-time board (submit + podium fetch)
src/systems/, src/shared/ // copy-in platform systems (ads, trusted clock)
src/ui/                   // menu, shop, settings, HUD, game over
```