/**
 * Minimal pooled particle system for little juice bursts (landing dust, coin
 * sparkles). One instance per scene; the scene calls update(dt) every tick.
 */
import { Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';

interface Particle {
    sprite: Sprite;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    gravity: number;
    startScale: number;
}

export interface BurstOptions {
    color: number;
    count: number;
    /** Base speed, units/s (each particle randomizes around it). */
    speed: number;
    life: number;
    gravity: number;
    size: number;
    /** Bias emission direction: radians, undefined = full circle. */
    angle?: number;
    spread?: number;
}

export interface ParticleSystem {
    burst(x: number, y: number, opts: BurstOptions): void;
    update(dt: number): void;
    destroy(): void;
}

export function createParticleSystem(renderer: Renderer, parent: Container): ParticleSystem {
    const container = new Container();
    parent.addChild(container);

    // One shared white circle texture, tinted per burst.
    const g = new Graphics().circle(8, 8, 8).fill(0xffffff);
    const texture: Texture = renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();

    const live: Particle[] = [];
    const pool: Sprite[] = [];

    const obtain = (): Sprite => {
        const s = pool.pop() ?? new Sprite(texture);
        s.anchor.set(0.5);
        s.visible = true;
        container.addChild(s);
        return s;
    };

    return {
        burst(x, y, opts) {
            for (let i = 0; i < opts.count; i++) {
                const angle = opts.angle !== undefined
                    ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? Math.PI / 2)
                    : Math.random() * Math.PI * 2;
                const speed = opts.speed * (0.4 + Math.random() * 0.9);
                const sprite = obtain();
                sprite.tint = opts.color;
                sprite.position.set(x, y);
                const scale = (opts.size * (0.6 + Math.random() * 0.8)) / 16;
                sprite.scale.set(scale);
                live.push({
                    sprite,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: opts.life,
                    maxLife: opts.life,
                    gravity: opts.gravity,
                    startScale: scale,
                });
            }
        },
        update(dt) {
            for (let i = live.length - 1; i >= 0; i--) {
                const p = live[i];
                p.life -= dt;
                if (p.life <= 0) {
                    p.sprite.visible = false;
                    container.removeChild(p.sprite);
                    pool.push(p.sprite);
                    live.splice(i, 1);
                    continue;
                }
                p.vy += p.gravity * dt;
                p.sprite.x += p.vx * dt;
                p.sprite.y += p.vy * dt;
                const t = p.life / p.maxLife;
                p.sprite.alpha = t;
                p.sprite.scale.set(p.startScale * (0.5 + 0.5 * t));
            }
        },
        destroy() {
            live.length = 0;
            pool.length = 0;
            container.destroy({ children: true });
            texture.destroy(true);
        },
    };
}
