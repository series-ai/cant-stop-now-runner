# Endless Runner Template — build your own runner on this scaffolding

A complete, playable 2D endless runner for RUN.game, meant to be turned into
YOUR game — not reskinned. Built on `run-template-2d-pixi-react` patterns
(design-unit stage, store bridge, SDK posture, boot order), which all hold.
Coordinates: gameplay happens in a `world` container where **y = 0 is the
ground line and up is negative**; the world is bottom-anchored via the
background's ground measurement. Search `ADAPT:` for every intended edit
point.

## Structure (systems vs example content)

Systems (keep, tune, or delete whole):

- **src/game/config.ts** — every gameplay tunable (physics, speed ramp,
  spawn pacing, archetypes, ads, palette). Tune here first; code reads all
  of it.
- **src/game/runnerScene.ts** — run orchestrator: ticker loop, input
  (canvas pointer + keyboard), scoring, collision → death → game-over. One
  scene instance per run; restarts are keyed remounts (`store.runId`), so
  there is no reset path to maintain.
- **src/game/player.ts** — jump physics with the game-feel kit: coyote
  time, jump buffer, variable height (release cut), double jump, squash &
  stretch, landing assist support. The floor height is passed in per frame,
  so platforms work (walking off an edge grants coyote time).
- **src/game/obstacles.ts** — spawner. Fairness rules: gaps scale with
  speed (constant reaction TIME), hard archetypes unlock by distance
  (`minMeters`), hitboxes smaller than the art, `safeTop` obstacles are
  walkable via `floorAt()`/`resolve()` (sides still kill).
- **src/game/background.ts** — parallax layers + the authoritative
  `groundTopY()`; re-anchors on resize; includes the TilingSprite
  addressModeV clamp (prevents a hairline at the top of tiling layers).
- **src/game/particles.ts** — pooled particle bursts.
- **src/audio/audio.ts** — music/sfx buses, synthesized placeholders, and
  the documented real-file swap (header comment). Volumes persist in the
  save; Settings screen edits them.
- **src/state/save.ts** — persistence: RUN `appStorage` + localStorage
  write-through, loaded once at boot (main.tsx step 2), flushed on
  onSleep/onQuit. All mutations return new state for store patching.
- **src/systems/ads.ts + src/shared/serverTime.ts + src/sdk/ads.ts** —
  rewarded-ads core from the npm package `@series-inc/run-game-helpers`
  (copy-in library; get daily rewards, IAP shop, quests, tutorial and more
  from it the same way): shared daily cap on a trusted clock, subscriber
  instant-grant, RunBucks fallback, `grantReward()` chokepoint, dev
  fake-ads outside the host. To drop ads: remove those files, the
  `save.ads` slice, and the GameOver offer block.
- **src/sdk/leaderboard.ts + rundot/leaderboard.config.json +
  src/ui/Leaderboard.tsx** — all-time leaderboard (simple security; the
  board is auto-created on `rundot deploy` from the config). The scene
  submits at run end fire-and-forget (server keeps each player's best; the
  returned rank shows on the game-over screen); the LEADERBOARD screen renders
  top 10 with medal rows plus the player's neighborhood in one
  `getPodiumScores` call. Real boards are host-only: in plain-browser dev
  the SDK self-mocks after init, so `sdkReady()` is TRUE, fetches succeed
  against an empty mock board, and the UI shows its EMPTY state (the
  offline state only appears if SDK init itself fails). ADAPT:
  what score means, the config bounds, and the "m" display suffix.
- **src/ui/** — screens: `MainMenu`, `Shop`, `Settings`, `Leaderboard`,
  `Hud` (overlay is pointer-events-none so taps reach the canvas; quit
  confirmation freezes the game), `GameOver` (canvas stays mounted
  underneath).

Example content (REPLACE with your game's):

- Obstacle archetypes in `config.ts` (crates/spikes) — any shapes work;
  new `kind`s need a display case in obstacles.ts `buildNode()`.
- **src/game/skins.ts** — example cosmetics catalog for the shop. Replace
  entries, rework into other cosmetics, or delete the system (file,
  Shop.tsx, skin fields in save/store, SHOP button).
- The synth song data and SFX voices in `audio/audio.ts`.
- Titles/copy in `index.html`, `MainMenu`, `LoadingScreen`; palette in
  `app.css` + `config.ts`.

## Art: real images over procedural fallbacks

Every texture resolves REAL ART FIRST (alias listed in
`src/assets/manifest.ts` → loaded at boot), then falls back to the drawn
placeholder — so you can replace art one sprite at a time and the game
always runs. Scene teardown calls `freeTexture()` (textures.ts), which
frees placeholders but never manifest art. Author at 2x the design-unit
display size (crisper at high DPR); sprites size themselves, so exact
pixels matter less than aspect.

| Alias | Display (design units) | Author (px) | Notes |
|---|---|---|---|
| `player` | 84 × 96 body | 168 × 250 | Feet-anchored; top 30% of image height is hat headroom above the body; used for ALL skins unless per-skin art exists |
| `player-<skinId>` | same | same | Per-skin override (procedural recolor/hats do not apply to real art) |
| `crate` | 110 × 110 unit | 220 × 220 | Square UNIT; code stacks it for wide/tall obstacles |
| `spike` | 64 × 64 unit | 128 × 128 | ONE triangle; code tiles a strip |
| `coin` | 56 × 56 | 112 × 112 | |
| `cloud` | ~130 × 55 | 520 × 220 | |
| `city` | 720 wide × 220 tall | 1440 × 440 | MUST tile horizontally seamlessly |
| `hills` | 720 wide × 160 tall | 1440 × 320 | MUST tile horizontally seamlessly |
| `ground` | 360 wide × 170 tall | 720 × 340 | MUST tile horizontally; top edge is the walking surface |
| `sky` | full screen | e.g. 16 × 512 | Stretched to fit; a soft vertical gradient |

Tiling layers assume 2x-authored art (TilingSprite tileScale is 0.5).

## UI Copy Style

- Never use em dashes (—) in player-facing text. Use commas, parentheses,
  or separate lines instead. (Code comments are exempt.)
- Keep instructions short and imperative, one idea per line.
- Minimum text size: 1.1rem (~17.6px). Never render player-facing text
  smaller unless explicitly asked, it is too small to read on most mobile
  devices. Tailwind's text-xs/text-sm are both below this floor; use
  text-[1.1rem] or larger instead.

## Invariants to Preserve

- Store patches on discrete events only (meter ticks, pickups, phase
  changes) — never per-frame.
- Textures freed via `freeTexture()` on scene teardown, never
  `texture.destroy()` directly.
- `dt` clamped to 50ms in the scene tick (tab-switch spikes must not
  tunnel the player through obstacles).
- SDK calls (analytics, haptics, storage, ads) are try/catch'd AND
  promise-caught; the game must run SDK-less in a plain browser.
- Gameplay input listens on `app.canvas` (HUD buttons never double as game
  input); keyboard on window for desktop dev.
- The ads system mutates `save.ads` IN PLACE — keep that reference stable.
- Scrollable DOM lists need `touch-pan-y` (body locks touch-action for
  game input).

## AI Agent Recipes (complete checklists for common requests)

After ANY recipe, run `npx tsc --noEmit` — the compiler catches leftovers
(`noUnusedLocals` is on, so dead imports fail the build).

**"Remove the cosmetics/skins/shop"**
- Delete `src/game/skins.ts`, `src/game/skinPreviews.ts`, `src/ui/Shop.tsx`.
- `src/ui/App.tsx`: remove the Shop import and the `phase === 'shop'` route.
- `src/ui/MainMenu.tsx`: remove the SHOP button.
- `src/state/store.ts`: remove `unlockedSkins` + `equippedSkin` (interface
  and initial state); remove `'shop'` from the phase union.
- `src/state/save.ts`: remove `unlockedSkins`/`equippedSkin` from SaveData,
  DEFAULTS, and parse(); delete `buySkin`/`equipSkin`; remove the
  `DEFAULT_SKIN_ID` import.
- `src/main.tsx`: remove `unlockedSkins`/`equippedSkin` from the boot patch.
- `src/game/player.ts`: remove the `getSkin`/`getSave` imports and call
  `makePlayerTexture(renderer)`.
- `src/game/textures.ts`: collapse `makePlayerTexture` to one look (drop
  the `skin` param, `drawHat`, `starPoints`, the `Skin` import).
- `src/styles/app.css`: remove the `.skin-bob` keyframes block.
- Decide: keep `totalCoins` as pure score, or remove the wallet if nothing
  spends it anymore.

**"Remove rewarded ads"**
- Delete `src/systems/ads.ts` and `src/sdk/ads.ts`; also
  `src/shared/serverTime.ts` if nothing else uses the trusted clock.
- `src/state/save.ts`: remove the `ads` slice (SaveData, DEFAULTS, parse)
  and the `AdsState` import.
- `src/ui/GameOver.tsx`: remove the double-coins offer block and dialog,
  the `adsSystem`/`formatCountdown` imports, and the `adFlow`/`adReady`/
  `failNote` state.
- `src/main.tsx`: remove the `refreshServerTime` import and calls (if
  serverTime was deleted).
- `src/game/config.ts`: remove the `ads` section.

**"Remove audio"**
- Delete `src/audio/audio.ts` and `src/ui/Settings.tsx`.
- `src/ui/App.tsx`: remove the Settings import/route; `src/ui/MainMenu.tsx`:
  remove the gear button; `src/state/store.ts`: remove `musicVolume`/
  `sfxVolume` and `'settings'` from the phase union.
- Remove all `sfx.*` calls and audio imports in: `src/game/player.ts`,
  `src/game/runnerScene.ts`, `src/ui/Shop.tsx`, `src/ui/GameOver.tsx`,
  `src/ui/MainMenu.tsx`.
- `src/state/save.ts`: remove `settings` (SaveData, DEFAULTS, parse) and
  `setSettings`; `src/main.tsx`: remove `initAudio`/`suspendAudio`/
  `resumeAudio`, the volume boot patch, and the visibilitychange listener.

**"Remove the leaderboard"**
- Delete `src/sdk/leaderboard.ts`, `src/ui/Leaderboard.tsx`, and
  `rundot/leaderboard.config.json`.
- `src/ui/App.tsx`: remove the Leaderboard import and the
  `phase === 'leaderboard'` route.
- `src/ui/MainMenu.tsx`: remove the LEADERBOARD button.
- `src/state/store.ts`: remove `lbRank` (interface, initial state, and the
  `startRun` reset); remove `'leaderboard'` from the phase union.
- `src/game/runnerScene.ts`: remove the `submitRunScore` import and the
  submit block in `endRun`.
- `src/ui/GameOver.tsx`: remove the `lbRank` selector and the
  "#N all time" line.

**"Add an obstacle type"**
- `src/game/config.ts`: add an archetype entry (kind/width/height/weight/
  minMeters/safeTop).
- `src/game/obstacles.ts`: add a display case in `buildNode()` (new texture
  in textures.ts + manifest alias if it needs new art).

**"Add a skin / cosmetic"**
- Append to `SKINS` in `src/game/skins.ts`; new hat kinds need a `drawHat`
  case in textures.ts. Nothing else — shop, previews, save all read the list.

**"Use my art / my audio"** — see the art table above (manifest aliases)
and the ADAPT header in `src/audio/audio.ts`.

**"Rename the game"** — `<title>` in index.html, headings in
`MainMenu.tsx` + `LoadingScreen.tsx`, `name` in package.json, SAVE_KEY in
`src/state/save.ts`.

## Verification

- `npm run build` (type-checks then bundles) passes; `npm run dev` boots
  to the menu with no console errors.
- Play: jump/double-jump feel snappy; crate tops are walkable; death →
  game over → RETRY restarts cleanly (no WebGL context warnings); best
  and wallet survive a reload; shop buy auto-equips; volume sliders
  persist; ad doubling works (fake ad in dev) and respects the daily cap.
- Resize the device toolbar during a run: ground stays bottom-anchored.
- Before first deploy: real 512×512 `public/thumbnail.jpg`, `rundot init`
  has been run.
