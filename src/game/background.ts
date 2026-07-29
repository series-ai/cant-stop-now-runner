/**
 * Parallax backdrop: sky gradient, drifting clouds, city silhouette, rolling
 * hills, and the scrolling ground strip. Each layer scrolls at its own factor
 * of the world speed, which is what sells the sense of depth and motion.
 *
 * Layout is bottom-anchored off the ground line: groundTopY() = screen height
 * minus the ground strip, and every layer hangs off that. Re-anchoring on
 * resize is handled here so the scene doesn't have to care.
 */
import { Container, Sprite, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import type { Stage } from './stage.ts';
import { CONFIG } from './config.ts';
import {
    makeSkyTexture, makeCloudTexture, makeCityTexture, makeHillsTexture, makeGroundTexture,
    freeTexture,
} from './textures.ts';

/** Scroll factor per layer (× world speed). */
const FACTORS = {
    clouds: 0.06,
    city: 0.15,
    hills: 0.35,
    ground: 1.0,
};

export interface Background {
    /** y (design units) of the top of the ground — the gameplay ground line. */
    groundTopY(): number;
    /** Advance all layers by a world-scroll delta of dx units. */
    scroll(dx: number, dt: number): void;
    destroy(): void;
}

/**
 * These layers tile horizontally only, but Pixi's TilingSprite forces the
 * sampler to wrap on BOTH axes — so the tile's top edge bilinearly blends
 * with its (solid) bottom row and draws a faint full-width line above the
 * layer. Clamp V; set U explicitly so the pipe's `addressMode !== 'repeat'`
 * check (which reads the U getter) doesn't stomp the V override.
 */
function tileHorizontallyOnly(texture: Texture): Texture {
    const style = texture.source.style;
    style.addressModeU = 'repeat';
    style.addressModeV = 'clamp-to-edge';
    style.update();
    return texture;
}

export function createBackground(renderer: Renderer, stage: Stage): Background {
    const root = new Container();
    stage.root.addChild(root);

    const sky = new Sprite(makeSkyTexture());
    root.addChild(sky);

    const cloudTex = makeCloudTexture(renderer);
    const clouds: Sprite[] = [];
    // Fixed seeds so layout is stable; x respawns randomize during play.
    const cloudSeeds = [
        { x: 80, y: 140, s: 0.55, drift: 14 },
        { x: 420, y: 300, s: 0.75, drift: 10 },
        { x: 620, y: 90, s: 0.45, drift: 18 },
    ];
    for (const seed of cloudSeeds) {
        const c = new Sprite(cloudTex);
        c.anchor.set(0.5);
        c.scale.set(seed.s / 2); // textures are drawn at 2x
        c.alpha = 0.9;
        c.position.set(seed.x, seed.y);
        root.addChild(c);
        clouds.push(c);
    }

    const city = new TilingSprite({ texture: tileHorizontallyOnly(makeCityTexture(renderer)), width: stage.width, height: 220 });
    city.tileScale.set(0.5);
    city.alpha = 0.75;
    root.addChild(city);

    const hills = new TilingSprite({ texture: tileHorizontallyOnly(makeHillsTexture(renderer)), width: stage.width, height: 160 });
    hills.tileScale.set(0.5);
    root.addChild(hills);

    const ground = new TilingSprite({
        texture: tileHorizontallyOnly(makeGroundTexture(renderer)),
        width: stage.width,
        height: CONFIG.ground.height,
    });
    ground.tileScale.set(0.5);
    root.addChild(ground);

    let groundTop = 0;

    const layout = () => {
        const h = stage.designHeight();
        groundTop = h - CONFIG.ground.height;
        sky.width = stage.width;
        sky.height = groundTop;
        city.y = groundTop - 220;
        hills.y = groundTop - 160;
        ground.y = groundTop;
    };
    layout();
    const offResize = stage.onResize(layout);

    return {
        groundTopY: () => groundTop,
        scroll(dx, dt) {
            city.tilePosition.x -= dx * FACTORS.city;
            hills.tilePosition.x -= dx * FACTORS.hills;
            ground.tilePosition.x -= dx * FACTORS.ground;
            for (let i = 0; i < clouds.length; i++) {
                const c = clouds[i];
                c.x -= dx * FACTORS.clouds + cloudSeeds[i].drift * dt;
                if (c.x < -c.width) {
                    c.x = stage.width + c.width + Math.random() * 200;
                    c.y = 60 + Math.random() * 320;
                }
            }
        },
        destroy() {
            offResize();
            const textures = [sky.texture, cloudTex, city.texture, hills.texture, ground.texture];
            root.destroy({ children: true });
            for (const t of textures) freeTexture(t); // frees placeholders, never manifest art
        },
    };
}
