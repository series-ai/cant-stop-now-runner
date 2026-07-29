/**
 * The endless runner scene — orchestrates background, player, obstacles,
 * scoring, input, and the run → death → game-over flow. One scene instance
 * per run: App.tsx remounts GameCanvas (keyed by store.runId) to restart,
 * so this module never needs a reset path.
 *
 * Scene contract (from the base template): createRunnerScene(app, stage)
 * returns { destroy() } and cleans up everything it created.
 */
import { Container, type Application, type Ticker } from 'pixi.js';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
// Type-only import (erased at build): the /api entry doesn't re-export the
// enum, and the haptic styles are plain strings at runtime.
import type { HapticFeedbackStyle } from '@series-inc/rundot-game-sdk';
import { store } from '../state/store.ts';
import { recordRun } from '../state/save.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import { submitRunScore } from '../sdk/leaderboard.ts';
import type { Stage } from './stage.ts';
import { CONFIG } from './config.ts';
import { createBackground } from './background.ts';
import { createParticleSystem } from './particles.ts';
import { createPlayer } from './player.ts';
import { createSpawner } from './obstacles.ts';
import { sfx } from '../audio/audio.ts';

/** The scene contract: every createXxxScene(app, stage) returns one of these. */
export interface Scene {
    destroy(): void;
}

export function createRunnerScene(app: Application, stage: Stage): Scene {
    const background = createBackground(app.renderer, stage);

    // Gameplay container: y = 0 is the ground line, up is negative. Bottom-
    // anchored via the background's ground measurement, kept in sync on
    // resize (background re-lays itself out first — it subscribed first).
    const world = new Container();
    world.y = background.groundTopY();
    stage.root.addChild(world);
    const offResize = stage.onResize(() => { world.y = background.groundTopY(); });

    const particles = createParticleSystem(app.renderer, world);
    const player = createPlayer(app.renderer, world, particles);
    const spawner = createSpawner(app.renderer, world, stage, particles);

    let state: 'running' | 'dying' = 'running';
    let elapsed = 0;
    let distanceUnits = 0;
    let shownMeters = 0;
    let coins = 0;
    let deathTimer = 0;
    let ended = false;

    // --- Input: pointer on the canvas (HUD buttons are DOM siblings above it,
    // so they never leak taps here), keyboard for desktop dev.
    const onPointerDown = () => player.press();
    const onPointerUp = () => player.release();
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.repeat) return;
        if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); player.press(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') player.release();
    };
    app.canvas.addEventListener('pointerdown', onPointerDown);
    app.canvas.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    if (sdkReady()) {
        try { RundotGameAPI.analytics.recordCustomEvent('run_start').catch(() => {}); } catch { /* non-fatal */ }
    }

    const die = () => {
        state = 'dying';
        deathTimer = CONFIG.death.duration;
        player.die();
        sfx.death();
        if (sdkReady()) {
            try {
                RundotGameAPI.triggerHapticAsync('error' as HapticFeedbackStyle).catch(() => { /* non-fatal */ });
            } catch { /* non-fatal */ }
        }
    };

    const endRun = () => {
        if (ended) return;
        ended = true;
        const meters = Math.floor(distanceUnits / CONFIG.score.unitsPerMeter);
        const { best, newBest, totalCoins } = recordRun(meters, coins);
        store.patch({ phase: 'gameover', distance: meters, coins, best, newBest, totalCoins });
        // Fire-and-forget: the server keeps the best score; a returned rank
        // shows up on the game-over screen when it lands.
        void submitRunScore(meters, Math.round(elapsed)).then((rank) => {
            if (rank !== null) store.patch({ lbRank: rank });
        });
        if (sdkReady()) {
            try {
                RundotGameAPI.analytics.recordCustomEvent('run_end', {
                    meters, coins, seconds: Math.round(elapsed),
                }).catch(() => {});
            } catch { /* non-fatal */ }
        }
    };

    const tick = (ticker: Ticker) => {
        // Clamp: after a tab-switch hiccup, never step more than 50ms at once.
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);
        particles.update(dt);

        if (state === 'running') {
            elapsed += dt;
            const ramp = Math.min(1, elapsed / CONFIG.speed.rampDuration);
            const speed = CONFIG.speed.start + (CONFIG.speed.max - CONFIG.speed.start) * ramp;
            const dx = speed * dt;

            background.scroll(dx, dt);
            distanceUnits += dx;
            const meters = Math.floor(distanceUnits / CONFIG.score.unitsPerMeter);
            spawner.update(dx, dt, speed, meters);

            // The floor under the player's feet: open ground or a crate top.
            const feet = player.bounds();
            player.update(dt, spawner.floorAt(feet.x, feet.x + feet.width));

            // Discrete store patches only: meter ticks and coin pickups.
            if (meters !== shownMeters) {
                shownMeters = meters;
                store.patch({ distance: meters });
            }
            const picked = spawner.collectCoins(player.bounds());
            if (picked > 0) {
                coins += picked;
                store.patch({ coins });
                sfx.coin();
            }

            // Contact: a near-top touch of a safe obstacle is a landing
            // assist; anything else (crate sides, spikes) is death.
            const contact = spawner.resolve(player.bounds(), player.velocityY());
            if (contact.hit) die();
            else if (contact.landOn !== undefined) player.forceLand(contact.landOn);
        } else {
            // Death tumble: world stops, player pops and falls off-screen.
            player.update(dt, 0);
            deathTimer -= dt;
            if (deathTimer <= 0) endRun();
        }
    };
    app.ticker.add(tick);

    return {
        destroy() {
            app.ticker.remove(tick);
            app.canvas.removeEventListener('pointerdown', onPointerDown);
            app.canvas.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            offResize();
            spawner.destroy();
            player.destroy();
            particles.destroy();
            background.destroy();
            world.destroy({ children: true });
        },
    };
}
