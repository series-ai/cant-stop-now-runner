/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * Files live in public/ (URLs are relative to the page, so 'images/x.png'
 * means public/images/x.png; works in dev and in the deployed subdirectory).
 *
 * Two tiers (the pattern production RUN games use):
 *   - 'critical'  — awaited during the loading screen. Everything the first
 *                   interactive screen needs: menu art, UI chrome, the sprites
 *                   visible in the first seconds of play.
 *   - 'deferred'  — fire-and-forget background load after boot. Sub-screen
 *                   art, late-game content, anything the player can't see yet.
 *
 * REAL ART GOES HERE. The template draws placeholder art procedurally
 * (src/game/textures.ts), so both tiers ship empty — but every art slot has
 * an alias, and listing an image under that alias REPLACES the placeholder,
 * one sprite at a time, no code changes:
 *
 *   { alias: 'player', src: 'images/player.png' }
 *
 * Recognized aliases (art spec with sizes in CLAUDE.md): player,
 * player-<skinId>, crate, spike, coin, cloud, city, hills, ground, sky.
 * Keep 'critical' small: every asset there delays first interaction.
 */
import type { AssetsManifest, UnresolvedAsset } from 'pixi.js';

/**
 * A narrowing of Pixi's AssetsManifest: Pixi also allows `assets` to be a
 * record, but this template keeps it an array so the tier filters below can
 * check `assets.length`. Still assignable to AssetsManifest (Assets.init).
 */
export interface Manifest extends AssetsManifest {
    bundles: { name: string; assets: UnresolvedAsset[] }[];
}

export const MANIFEST: Manifest = {
    bundles: [
        {
            name: 'critical',
            assets: [
                { alias: 'crate', src: 'resources/crate.png' },
                { alias: 'spike', src: 'resources/spike.png' },
                // 10-frame coin spin sheet; textures.ts makeCoinTextures
                // slices it (frame rects from resources/coin.json, baked in —
                // Pixi force-parses any loaded .json with a 'frames' key as a
                // spritesheet, so the json must never go through Assets).
                { alias: 'coin-sheet', src: 'resources/coin.png' },
                { alias: 'cloud', src: 'resources/cloud.png' },
                { alias: 'city', src: 'resources/city_bg1.png' },
                // hills_tile1 is hills_bg1 with the tall flat skirt below the
                // mounds cropped off, so the mounds sit on the ground line.
                { alias: 'hills', src: 'resources/hills_tile1.png' },
                // ground_tile1 is ground_strip1 with its transparent top
                // cropped off (the layer's top edge is the walking surface).
                { alias: 'ground', src: 'resources/ground_tile1.png' },
            ],
        },
        {
            name: 'deferred',
            assets: [
                // sub-screen backgrounds, per-level art, shop icons...
            ],
        },
    ],
};

// Empty bundles are skipped so an unused tier never errors.
export const CRITICAL_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name !== 'deferred' && b.assets.length > 0)
    .map((b) => b.name);

export const DEFERRED_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name === 'deferred' && b.assets.length > 0)
    .map((b) => b.name);
