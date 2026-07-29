/**
 * Shop previews: the ACTUAL runner character rendered once per skin (same
 * makePlayerTexture the game uses) and exported as data-URL images that
 * plain React <img> tags can show — no per-row canvases.
 *
 * A temporary offscreen Pixi renderer draws all 12 and is destroyed
 * immediately; results are cached for the session.
 */
import { autoDetectRenderer, Sprite } from 'pixi.js';
import { SKINS } from './skins.ts';
import { makePlayerTexture, freeTexture } from './textures.ts';

let cache: Record<string, string> | null = null;
let inFlight: Promise<Record<string, string>> | null = null;

export function getSkinPreviews(): Promise<Record<string, string>> {
    if (cache) return Promise.resolve(cache);
    if (inFlight) return inFlight;
    inFlight = (async () => {
        const renderer = await autoDetectRenderer({
            width: 8, height: 8, backgroundAlpha: 0, antialias: true,
        });
        const previews: Record<string, string> = {};
        try {
            for (const skin of SKINS) {
                const texture = makePlayerTexture(renderer, skin);
                const sprite = new Sprite(texture);
                previews[skin.id] = await renderer.extract.base64(sprite);
                sprite.destroy();
                freeTexture(texture);
            }
        } finally {
            renderer.destroy();
        }
        cache = previews;
        inFlight = null;
        return previews;
    })();
    return inFlight;
}
