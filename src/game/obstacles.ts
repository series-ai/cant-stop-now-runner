/**
 * Obstacle + coin spawning, scrolling, and collision. Everything lives in the
 * world container (y = 0 is the ground line, up is negative) and scrolls left
 * past the fixed-x player.
 *
 * Fairness rules built in:
 *  - Gaps are speed-scaled (constant reaction time as the game accelerates).
 *  - Hard archetypes unlock by distance (CONFIG.obstacles[].minMeters).
 *  - Hitboxes are slightly smaller than the art.
 */
import { Container, Sprite, type Renderer } from 'pixi.js';
import { CONFIG } from './config.ts';
import { makeCrateTexture, makeSpikeTexture, makeCoinTexture, freeTexture } from './textures.ts';
import type { Rect } from './player.ts';
import type { Stage } from './stage.ts';
import type { ParticleSystem } from './particles.ts';

interface Obstacle {
    node: Container;
    hitbox: Rect; // relative to node.x (x offset 0) — world x is node.x
    width: number;
    /** Visual height — the walkable surface of safe-top obstacles is -height. */
    height: number;
    /** True = the player can stand on top; only the sides kill. */
    safeTop: boolean;
}

interface Coin {
    sprite: Sprite;
    baseY: number;
    age: number;
    collected: boolean;
}

export interface Spawner {
    /** Advance the world by dx units; spawn/recycle as needed. */
    update(dx: number, dt: number, speed: number, meters: number): void;
    /**
     * y of the walking surface under the feet range [left, right]: 0 on open
     * ground, the (negative) top of the highest safe-top obstacle otherwise.
     */
    floorAt(left: number, right: number): number;
    /**
     * Resolve obstacle contact. A safe-top obstacle touched near its top
     * while falling is a landing (landOn = surface y to snap to); everything
     * else that overlaps is a hit.
     */
    resolve(player: Rect, vy: number): { hit: boolean; landOn?: number };
    /** Collect overlapped coins; returns how many were picked up. */
    collectCoins(player: Rect): number;
    destroy(): void;
}

const overlaps = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function createSpawner(
    renderer: Renderer,
    world: Container,
    stage: Stage,
    particles: ParticleSystem
): Spawner {
    const crateTex = makeCrateTexture(renderer);
    const spikeTex = makeSpikeTexture(renderer);
    const coinTex = makeCoinTexture(renderer);

    const obstacles: Obstacle[] = [];
    const coins: Coin[] = [];

    let distToNext = CONFIG.spawn.safeStartUnits;

    /** Build the display node for an archetype (bottom-left at local 0,0-up). */
    const buildNode = (kind: string, width: number, height: number): Container => {
        const node = new Container();
        if (kind === 'spikes') {
            const n = Math.max(1, Math.round(width / 64));
            const w = width / n;
            for (let i = 0; i < n; i++) {
                const s = new Sprite(spikeTex);
                s.anchor.set(0, 1);
                s.width = w;
                s.height = height;
                s.position.set(i * w, 0);
                node.addChild(s);
            }
        } else {
            // Crates: stack unit cubes so the texture never stretches.
            const size = 110;
            const cols = Math.max(1, Math.round(width / size));
            const rows = Math.max(1, Math.round(height / size));
            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    const s = new Sprite(crateTex);
                    s.anchor.set(0, 1);
                    s.width = size;
                    s.height = size;
                    s.position.set(cx * size, -cy * size);
                    node.addChild(s);
                }
            }
        }
        return node;
    };

    const spawnCoin = (x: number, y: number) => {
        const s = new Sprite(coinTex);
        s.anchor.set(0.5);
        s.width = CONFIG.coins.size;
        s.height = CONFIG.coins.size;
        s.position.set(x, y);
        world.addChild(s);
        coins.push({ sprite: s, baseY: y, age: Math.random() * Math.PI * 2, collected: false });
    };

    /** Arc of coins over an obstacle — outer coins single-jump, apex double. */
    const spawnCoinArc = (cx: number, obstacleH: number) => {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1) - 0.5; // -0.5..0.5
            const x = cx + t * 340;
            const y = -(obstacleH + 110 + (1 - (2 * t) * (2 * t)) * 130);
            spawnCoin(x, y);
        }
    };

    const spawnCoinRow = (startX: number, y: number, count: number) => {
        for (let i = 0; i < count; i++) spawnCoin(startX + i * 90, y);
    };

    const spawnObstacle = (speed: number, meters: number) => {
        const unlocked = CONFIG.obstacles.filter((o) => meters >= o.minMeters);
        const totalWeight = unlocked.reduce((sum, o) => sum + o.weight, 0);
        let roll = Math.random() * totalWeight;
        let arch = unlocked[0];
        for (const o of unlocked) {
            roll -= o.weight;
            if (roll <= 0) { arch = o; break; }
        }

        const x = stage.width + 150;
        const node = buildNode(arch.kind, arch.width, arch.height);
        node.position.set(x, 0);
        world.addChild(node);

        // Spikes get an extra-forgiving hitbox (art reads pointier than fair).
        const shrink = arch.kind === 'spikes' ? 0.72 : 0.94;
        const hw = arch.width * shrink;
        const hh = arch.height * (arch.kind === 'spikes' ? 0.7 : 0.96);
        obstacles.push({
            node,
            width: arch.width,
            height: arch.height,
            safeTop: arch.safeTop,
            hitbox: { x: (arch.width - hw) / 2, y: -hh, width: hw, height: hh },
        });

        // Coins over the obstacle...
        if (Math.random() < CONFIG.coins.arcChance) {
            spawnCoinArc(x + arch.width / 2, arch.height);
        }

        // ...and schedule the next gap (reaction-time constant).
        const gap = Math.max(
            CONFIG.spawn.minGapUnits,
            speed * rand(CONFIG.spawn.minLead, CONFIG.spawn.maxLead)
        );
        // Long gap? Drop a coin row in the middle of it.
        if (gap >= CONFIG.coins.rowMinGap && Math.random() < CONFIG.coins.rowChance) {
            const count = 3 + Math.floor(Math.random() * 3);
            spawnCoinRow(x + arch.width + gap * 0.4, -rand(60, 240), count);
        }
        distToNext = gap + arch.width;
    };

    return {
        update(dx, dt, speed, meters) {
            distToNext -= dx;
            if (distToNext <= 0) spawnObstacle(speed, meters);

            for (let i = obstacles.length - 1; i >= 0; i--) {
                const o = obstacles[i];
                o.node.x -= dx;
                if (o.node.x + o.width < -100) {
                    o.node.destroy({ children: true });
                    obstacles.splice(i, 1);
                }
            }
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i];
                c.sprite.x -= dx;
                c.age += dt;
                c.sprite.y = c.baseY + Math.sin(c.age * 4) * 8; // gentle bob
                c.sprite.scale.x = Math.abs(Math.cos(c.age * 3)) * (c.sprite.scale.y); // spin
                if (c.sprite.x < -100) {
                    c.sprite.destroy();
                    coins.splice(i, 1);
                }
            }
        },
        floorAt(left, right) {
            // Full visual width counts as support (edge-of-crate stands work);
            // the deadly hitbox is narrower, so the two never disagree.
            let floor = 0;
            for (const o of obstacles) {
                if (!o.safeTop) continue;
                if (o.node.x < right && o.node.x + o.width > left) {
                    floor = Math.min(floor, -o.height);
                }
            }
            return floor;
        },
        resolve(player, vy) {
            let landOn: number | undefined;
            for (const o of obstacles) {
                const hb = o.hitbox;
                if (!overlaps(player, { x: o.node.x + hb.x, y: hb.y, width: hb.width, height: hb.height })) {
                    continue;
                }
                const top = -o.height;
                const feetY = player.y + player.height;
                if (o.safeTop && vy >= 0 && feetY <= top + CONFIG.landingAssist) {
                    // Corner-clip while falling → snap onto the crate instead
                    // of dying. Keep the highest candidate surface.
                    landOn = Math.min(landOn ?? 0, top);
                } else {
                    return { hit: true };
                }
            }
            return { hit: false, landOn };
        },
        collectCoins(player) {
            let picked = 0;
            for (let i = coins.length - 1; i >= 0; i--) {
                const c = coins[i];
                const half = CONFIG.coins.size / 2;
                const box: Rect = {
                    x: c.sprite.x - half, y: c.sprite.y - half,
                    width: CONFIG.coins.size, height: CONFIG.coins.size,
                };
                if (overlaps(player, box)) {
                    picked++;
                    particles.burst(c.sprite.x, c.sprite.y, {
                        color: CONFIG.colors.coin, count: 7, speed: 300,
                        life: 0.35, gravity: 500, size: 12,
                    });
                    c.sprite.destroy();
                    coins.splice(i, 1);
                }
            }
            return picked;
        },
        destroy() {
            for (const o of obstacles) o.node.destroy({ children: true });
            for (const c of coins) c.sprite.destroy();
            obstacles.length = 0;
            coins.length = 0;
            freeTexture(crateTex);
            freeTexture(spikeTex);
            freeTexture(coinTex);
        },
    };
}
