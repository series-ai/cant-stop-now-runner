/**
 * The runner: jump physics with the standard game-feel kit — coyote time,
 * jump buffering, variable jump height (release to cut), double jump, and
 * squash & stretch. Lives in the world container where y = 0 is the ground
 * line and up is negative.
 *
 * The floor is not always y = 0: safe-top obstacles (crates) are walkable,
 * so the scene samples the surface under the player each frame (see
 * spawner.floorAt) and passes it to update(). Walking off a crate edge
 * starts coyote time, so a late jump still counts.
 */
import { Sprite, type Container, type Renderer } from 'pixi.js';
import { CONFIG } from './config.ts';
import { makePlayerTexture, freeTexture, PLAYER_TEX_HEADROOM } from './textures.ts';
import { getSkin } from './skins.ts';
import { getSave } from '../state/save.ts';
import { sfx } from '../audio/audio.ts';
import type { ParticleSystem } from './particles.ts';

const P = CONFIG.physics;

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Player {
    /** Axis-aligned hitbox in world coordinates (slightly forgiving). */
    bounds(): Rect;
    grounded(): boolean;
    /** Current vertical velocity (positive = falling). */
    velocityY(): number;
    /** Press = jump / double jump / buffer. Call from pointerdown/keydown. */
    press(): void;
    /** Release = cut the jump short. Call from pointerup/keyup. */
    release(): void;
    /**
     * @param floorY y of the surface under the player (0 = ground, negative
     *   on top of a crate) — sampled by the scene each frame.
     */
    update(dt: number, floorY: number): void;
    /** Landing-assist snap onto a surface (see spawner.resolve). */
    forceLand(floorY: number): void;
    /** Death pop: flips the sprite loose from physics; scene animates it. */
    die(): void;
    sprite: Sprite;
    destroy(): void;
}

export function createPlayer(
    renderer: Renderer,
    world: Container,
    particles: ParticleSystem
): Player {
    // Wear the equipped skin (scene remounts per run, so equips apply cleanly).
    const skin = getSkin(getSave().equippedSkin);
    const texture = makePlayerTexture(renderer, skin);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1); // feet at sprite.y — floor contact is y = floorY
    sprite.width = CONFIG.player.width;
    // The texture carries headroom for the hat; scale so the BODY is exactly
    // CONFIG.player.height (the hat pokes above, hitbox unchanged).
    sprite.height = CONFIG.player.height * (1 + PLAYER_TEX_HEADROOM);
    sprite.position.set(CONFIG.player.x, 0);
    world.addChild(sprite);

    // Pixi Sprite width/height setters work through scale, so remember the
    // "natural" scale for squash & stretch math.
    const baseScaleX = sprite.scale.x;
    const baseScaleY = sprite.scale.y;

    let vy = 0;
    let isGrounded = true;
    let jumpsUsed = 0;
    let coyoteTimer = 0;
    let bufferTimer = 0;
    let dead = false;
    /** Extra squash/stretch factors, eased back to 1 every frame. */
    let squashX = 1;
    let squashY = 1;
    let runPhase = 0;
    let dustTimer = 0;

    const jump = () => {
        vy = -P.jumpVelocity;
        isGrounded = false;
        coyoteTimer = 0;
        bufferTimer = 0;
        jumpsUsed++;
        sfx.jump(jumpsUsed > 1); // double jump chirps a fifth higher
        squashX = 0.8;
        squashY = 1.22;
        particles.burst(sprite.x, sprite.y, {
            color: CONFIG.colors.dust, count: 6, speed: 220, life: 0.35,
            gravity: 900, size: 14, angle: Math.PI / 2, spread: Math.PI / 3,
        });
    };

    const land = (floorY: number) => {
        sprite.y = floorY;
        vy = 0;
        isGrounded = true;
        jumpsUsed = 0;
        sfx.land();
        squashX = 1.24;
        squashY = 0.78;
        particles.burst(sprite.x, sprite.y, {
            color: CONFIG.colors.dust, count: 8, speed: 260, life: 0.4,
            gravity: 1100, size: 15, angle: -Math.PI / 2, spread: Math.PI / 2.2,
        });
        if (bufferTimer > 0) jump();
    };

    return {
        sprite,
        grounded: () => isGrounded,
        velocityY: () => vy,
        bounds() {
            // Shrink the visual box ~18% so near-misses feel fair.
            const w = CONFIG.player.width * 0.82;
            const h = CONFIG.player.height * 0.9;
            return { x: sprite.x - w / 2, y: sprite.y - h, width: w, height: h };
        },
        press() {
            if (dead) return;
            if (isGrounded || coyoteTimer > 0) {
                jumpsUsed = 0; // ground (or coyote) jump resets the chain
                jump();
            } else if (jumpsUsed < P.maxJumps) {
                jump();
            } else {
                bufferTimer = P.jumpBufferTime; // remember the tap for landing
            }
        },
        release() {
            if (dead) return;
            if (vy < 0) vy *= P.jumpCutMultiplier;
        },
        update(dt, floorY) {
            if (dead) {
                // Scene drives the death tumble; keep applying gravity only.
                vy = Math.min(vy + P.gravity * dt, P.maxFallSpeed);
                sprite.y += vy * dt;
                sprite.rotation += 6 * dt;
                return;
            }

            coyoteTimer = Math.max(0, coyoteTimer - dt);
            bufferTimer = Math.max(0, bufferTimer - dt);

            if (isGrounded && sprite.y < floorY - 0.5) {
                // The surface scrolled out from under us (walked off a crate
                // edge): fall, but grant coyote time for a late jump.
                isGrounded = false;
                coyoteTimer = P.coyoteTime;
            }

            if (!isGrounded) {
                const prevY = sprite.y;
                vy = Math.min(vy + P.gravity * dt, P.maxFallSpeed);
                sprite.y += vy * dt;
                // Land only when crossing the floor from above — falling in
                // FRONT of a crate must not snap onto it (that's a side hit,
                // resolved by the collision check).
                if (vy >= 0 && prevY <= floorY && sprite.y >= floorY) {
                    land(floorY);
                }
                // Slight tilt following the arc
                sprite.rotation = Math.max(-0.16, Math.min(0.24, vy * 0.00012));
            } else {
                sprite.rotation = 0;
                // Run-cycle bob + a trickle of dust off the heels
                runPhase += dt * 14;
                squashY = Math.min(squashY, 1) * 1 + Math.sin(runPhase) * 0.025;
                dustTimer -= dt;
                if (dustTimer <= 0) {
                    dustTimer = 0.13;
                    particles.burst(sprite.x - CONFIG.player.width * 0.4, sprite.y - 4, {
                        color: CONFIG.colors.dust, count: 1, speed: 120, life: 0.3,
                        gravity: -300, size: 10, angle: Math.PI, spread: Math.PI / 5,
                    });
                }
            }

            // Ease squash & stretch back to neutral
            squashX += (1 - squashX) * Math.min(1, 10 * dt);
            squashY += (1 - squashY) * Math.min(1, 10 * dt);
            sprite.scale.set(baseScaleX * squashX, baseScaleY * squashY);
        },
        forceLand(floorY) {
            if (dead) return;
            land(floorY);
        },
        die() {
            if (dead) return;
            dead = true;
            vy = -CONFIG.death.popVelocity;
            isGrounded = false;
            sprite.scale.set(baseScaleX, baseScaleY);
        },
        destroy() {
            sprite.destroy();
            freeTexture(texture); // frees placeholders, never manifest art
        },
    };
}
