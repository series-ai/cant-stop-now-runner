/**
 * Every texture the game uses comes from here, resolved in two steps:
 *
 *   1. REAL ART — if the alias is listed in src/assets/manifest.ts (and so
 *      was loaded at boot), that image is used.
 *   2. PROCEDURAL FALLBACK — otherwise the placeholder is drawn at runtime,
 *      so the game always runs, even with zero bundled images.
 *
 * To swap in your art: drop a PNG in public/images/, add it to the manifest
 * under the alias named on the make*() function below, done — no code
 * changes. The art spec (expected size/aspect/tiling per alias) is in
 * CLAUDE.md.
 *
 * Procedural textures are drawn at 2x their design-unit display size and
 * scaled down by the sprites that use them, so edges stay crisp at high
 * DPR. Author real art at 2x too (see CLAUDE.md).
 */
import { Assets, Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
import { CONFIG } from './config.ts';
import { SKINS, type Skin } from './skins.ts';

const C = CONFIG.colors;

/** Generate at 2x and let sprites scale down — crisper on 2x-DPR screens. */
const SS = 2;

/** Procedurally generated textures, so freeTexture never destroys real art. */
const generated = new WeakSet<Texture>();

/** Manifest-listed art wins; the drawn placeholder is the fallback. */
function art(alias: string, fallback: () => Texture): Texture {
    if (Assets.cache.has(alias)) return Assets.get<Texture>(alias);
    return fallback();
}

function gen(renderer: Renderer, draw: (g: Graphics) => void): Texture {
    const g = new Graphics();
    draw(g);
    const tex = renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
    generated.add(tex);
    return tex;
}

/**
 * Scene teardown MUST use this instead of texture.destroy(): generated
 * placeholders are per-scene and freed; manifest-loaded art is shared in
 * the Assets cache and must survive scene remounts.
 */
export function freeTexture(tex: Texture): void {
    if (generated.has(tex)) tex.destroy(true);
}

/**
 * Extra space above the head in the player texture, as a fraction of the
 * body height — room for the skin's hat. player.ts sizes the sprite with
 * the same constant so the BODY always renders at CONFIG.player dimensions
 * (hats are pure decoration; the hitbox never grows).
 */
export const PLAYER_TEX_HEADROOM = 0.3;

/** 5-point star polygon, for the star antenna hat. */
function starPoints(cx: number, cy: number, outer: number, inner: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    return pts;
}

/**
 * The skin's accessory, drawn in the headroom band [0..H] (plus a little
 * overlap onto the head, which starts at y = H). w/h are the BODY's scaled
 * dimensions. ADAPT: add or remove hat kinds alongside skins.ts.
 */
function drawHat(g: Graphics, skin: Skin, w: number, h: number, H: number): void {
    const c1 = skin.hatColor;
    const c2 = skin.hatColor2;
    switch (skin.hat) {
        case 'sweatband': // headband across the forehead, with a stripe
            g.roundRect(w * 0.02, H + h * 0.08, w * 0.96, h * 0.11, h * 0.05).fill(c1);
            g.rect(w * 0.02, H + h * 0.125, w * 0.96, h * 0.03).fill(c2);
            break;
        case 'sprout': { // little plant sprouting from the head
            g.roundRect(w * 0.47, H - h * 0.14, w * 0.06, h * 0.18, w * 0.03).fill(c2);
            g.ellipse(w * 0.36, H - h * 0.15, w * 0.13, h * 0.055).fill(c1);
            g.ellipse(w * 0.64, H - h * 0.15, w * 0.13, h * 0.055).fill(c1);
            break;
        }
        case 'crown':
            g.poly([
                w * 0.28, H - h * 0.16, w * 0.39, H - h * 0.04, w * 0.5, H - h * 0.18,
                w * 0.61, H - h * 0.04, w * 0.72, H - h * 0.16, w * 0.72, H + h * 0.06,
                w * 0.28, H + h * 0.06,
            ]).fill(c1);
            g.circle(w * 0.5, H + h * 0.01, w * 0.035).fill(c2);
            break;
        case 'headband': // martial-arts band with a short tail
            g.roundRect(w * 0.02, H + h * 0.08, w * 0.96, h * 0.1, h * 0.04).fill(c1);
            g.poly([w * 0.08, H + h * 0.12, 0, H + h * 0.3, w * 0.12, H + h * 0.18]).fill(c2);
            break;
        case 'antenna': // space antenna with a star
            g.rect(w * 0.485, H - h * 0.2, w * 0.03, h * 0.22).fill(c2);
            g.poly(starPoints(w * 0.5, H - h * 0.24, w * 0.1, w * 0.045)).fill(c1);
            break;
    }
}

/**
 * The runner: rounded body, face, little feet, and the skin's hat. Drawn
 * facing right. The texture is (1 + PLAYER_TEX_HEADROOM) taller than the
 * body — the top band belongs to the hat.
 *
 * Real-art aliases: `player-<skinId>` (per-skin image), falling back to
 * `player` (one image for every skin), falling back to the drawing. With
 * real player art the procedural recolor/hats no longer apply — ship
 * per-skin images or trim the skin catalog (see CLAUDE.md).
 */
export function makePlayerTexture(renderer: Renderer, skin: Skin = SKINS[0]): Texture {
    if (Assets.cache.has(`player-${skin.id}`)) return Assets.get<Texture>(`player-${skin.id}`);
    if (Assets.cache.has('player')) return Assets.get<Texture>('player');
    const w = CONFIG.player.width * SS;
    const h = CONFIG.player.height * SS;
    const H = h * PLAYER_TEX_HEADROOM; // headroom above the body for the hat
    return gen(renderer, (g) => {
        // Invisible bounds rect: every skin's texture has identical geometry
        // regardless of hat shape, so sprite sizing math never varies.
        g.rect(0, 0, w, h + H).fill({ color: 0x000000, alpha: 0 });
        // feet
        g.roundRect(w * 0.08, H + h * 0.86, w * 0.34, h * 0.14, w * 0.08).fill(skin.accent);
        g.roundRect(w * 0.56, H + h * 0.86, w * 0.34, h * 0.14, w * 0.08).fill(skin.accent);
        // body
        g.roundRect(0, H, w, h * 0.9, w * 0.28).fill(skin.body);
        // belly highlight
        g.roundRect(w * 0.12, H + h * 0.5, w * 0.76, h * 0.34, w * 0.2).fill({ color: 0xffffff, alpha: 0.14 });
        // eyes — set forward (running to the right)
        const eyeY = H + h * 0.3;
        g.circle(w * 0.58, eyeY, w * 0.13).fill(C.eyeWhite);
        g.circle(w * 0.86, eyeY, w * 0.13).fill(C.eyeWhite);
        g.circle(w * 0.62, eyeY, w * 0.06).fill(C.eyePupil);
        g.circle(w * 0.9, eyeY, w * 0.06).fill(C.eyePupil);
        // the skin's signature accessory
        drawHat(g, skin, w, h, H);
    });
}

/** Wooden crate — a square UNIT; obstacles stack it. Alias: 'crate'. */
export function makeCrateTexture(renderer: Renderer): Texture {
    return art('crate', () => {
        const s = 110 * SS;
        const b = s * 0.09; // border
        return gen(renderer, (g) => {
            g.rect(0, 0, s, s).fill(C.crateDark);
            g.rect(b, b, s - 2 * b, s - 2 * b).fill(C.crate);
            // diagonal plank
            g.moveTo(b, s - b).lineTo(s - b, b).stroke({ width: s * 0.07, color: C.crateDark });
        });
    });
}

/** ONE spike triangle; spike strips tile it. Alias: 'spike'. */
export function makeSpikeTexture(renderer: Renderer): Texture {
    return art('spike', () => {
        const w = 64 * SS;
        const h = 64 * SS;
        return gen(renderer, (g) => {
            g.poly([0, h, w / 2, 0, w, h]).fill(C.spike);
            g.poly([0, h, w / 2, 0, w / 2, h]).fill(C.spikeDark);
        });
    });
}

/** Coin pickup. Alias: 'coin'. */
export function makeCoinTexture(renderer: Renderer): Texture {
    return art('coin', () => {
        const s = CONFIG.coins.size * SS;
        const r = s / 2;
        return gen(renderer, (g) => {
            g.circle(r, r, r).fill(C.coinDark);
            g.circle(r, r, r * 0.82).fill(C.coin);
            g.circle(r - r * 0.28, r - r * 0.28, r * 0.24).fill(C.coinShine);
        });
    });
}

/**
 * Frame origins of the 10-frame coin spin, in sheet pixels — copied from
 * resources/coin.json (256px cells, coin01..coin10). Baked in because Pixi
 * force-parses any Assets-loaded .json with a 'frames' key as a spritesheet,
 * so the json file itself must never go through the loader.
 */
const COIN_SHEET_FRAMES: [number, number][] = [
    [0, 0], [256, 0], [512, 0], [768, 0],
    [0, 256], [256, 256], [512, 256], [768, 256],
    [0, 512], [256, 512],
];

/**
 * Animated coin: slices the spin sheet loaded under 'coin-sheet' into one
 * texture per frame. Falls back to the single static coin ('coin' alias or
 * the procedural placeholder) when the sheet isn't loaded.
 */
export function makeCoinTextures(renderer: Renderer): Texture[] {
    if (Assets.cache.has('coin-sheet')) {
        const sheet = Assets.get<Texture>('coin-sheet');
        // Inset each 256px cell to the 160px box around the coin — the sheet
        // leaves wide transparent margins that would render the coin tiny.
        // Measured union of all 10 frames' content: x 55-201, y 42-202.
        const INSET_X = 48;
        const INSET_Y = 42;
        const BOX = 160;
        return COIN_SHEET_FRAMES.map(([x, y]) => new Texture({
            source: sheet.source,
            frame: new Rectangle(x + INSET_X, y + INSET_Y, BOX, BOX),
        }));
    }
    return [makeCoinTexture(renderer)];
}

/** Soft cloud blob. Alias: 'cloud'. */
export function makeCloudTexture(renderer: Renderer): Texture {
    return art('cloud', () => {
        const w = 260 * SS;
        const h = 110 * SS;
        return gen(renderer, (g) => {
            g.ellipse(w * 0.3, h * 0.62, w * 0.28, h * 0.34).fill(C.cloud);
            g.ellipse(w * 0.55, h * 0.42, w * 0.3, h * 0.4).fill(C.cloud);
            g.ellipse(w * 0.76, h * 0.64, w * 0.22, h * 0.3).fill(C.cloud);
        });
    });
}

/** Far parallax silhouette — MUST tile horizontally. Alias: 'city'. */
export function makeCityTexture(renderer: Renderer): Texture {
    return art('city', () => {
        const w = 720 * SS;
        const h = 220 * SS;
        // Deterministic skyline (no Math.random — same skyline every boot).
        const buildings = [
            [0.0, 0.55], [0.09, 0.8], [0.17, 0.45], [0.24, 0.95], [0.33, 0.6],
            [0.41, 0.75], [0.5, 0.5], [0.57, 1.0], [0.66, 0.65], [0.74, 0.85],
            [0.83, 0.55], [0.9, 0.7],
        ];
        return gen(renderer, (g) => {
            for (let i = 0; i < buildings.length; i++) {
                const [x, bh] = buildings[i];
                const next = i + 1 < buildings.length ? buildings[i + 1][0] : 1.0;
                g.rect(x * w, h - bh * h, (next - x) * w + 2, bh * h).fill(C.cityFar);
            }
        });
    });
}

/** Mid parallax hills — MUST tile horizontally. Alias: 'hills'. */
export function makeHillsTexture(renderer: Renderer): Texture {
    return art('hills', () => {
        const w = 720 * SS;
        const h = 160 * SS;
        return gen(renderer, (g) => {
            // Two overlapping half-ellipse hills; both edges of the tile are at
            // y = h*0.55 so the texture tiles seamlessly.
            g.rect(0, h * 0.55, w, h * 0.45).fill(C.hills);
            g.ellipse(w * 0.28, h * 0.62, w * 0.34, h * 0.5).fill(C.hills);
            g.ellipse(w * 0.78, h * 0.68, w * 0.3, h * 0.42).fill(C.hillsShade);
        });
    });
}

/** Ground strip — MUST tile horizontally. Alias: 'ground'. */
export function makeGroundTexture(renderer: Renderer): Texture {
    return art('ground', () => {
        const w = 360 * SS;
        const h = CONFIG.ground.height * SS;
        const grassH = h * 0.22;
        return gen(renderer, (g) => {
            g.rect(0, 0, w, h).fill(C.dirt);
            // dirt speckles (deterministic)
            const specks = [
                [0.1, 0.45], [0.32, 0.7], [0.5, 0.4], [0.68, 0.8], [0.86, 0.55], [0.22, 0.88],
            ];
            for (const [x, y] of specks) {
                g.roundRect(x * w, y * h, w * 0.06, h * 0.05, 6).fill(C.dirtDark);
            }
            g.rect(0, 0, w, grassH).fill(C.grass);
            // grass blades along the lip
            for (let i = 0; i < 6; i++) {
                g.rect((i / 6) * w + w * 0.04, grassH * 0.55, w * 0.05, grassH * 0.45).fill(C.grassDark);
            }
        });
    });
}

/** Vertical sky gradient (canvas2d). Alias: 'sky' (a tall soft image works). */
export function makeSkyTexture(): Texture {
    if (Assets.cache.has('sky')) return Assets.get<Texture>('sky');
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    grad.addColorStop(0, hex(C.skyTop));
    grad.addColorStop(1, hex(C.skyBottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = Texture.from(canvas);
    generated.add(tex);
    return tex;
}
