/**
 * In-game HUD: a React overlay above the Pixi canvas.
 *
 * Pattern to keep: the overlay itself is pointer-events-none so taps fall
 * through to the canvas (that's how you jump); each interactive control opts
 * back in with pointer-events-auto. `pt-safe-top` (see app.css) pads below
 * the RUN host header.
 */
import { store, useStore } from '../state/store.ts';

export default function Hud() {
    const distance = useStore((s) => s.distance);
    const coins = useStore((s) => s.coins);
    const best = useStore((s) => s.best);
    const paused = useStore((s) => s.paused);
    const quitConfirm = useStore((s) => s.quitConfirm);
    return (
        <div className="pointer-events-none absolute inset-0 pt-safe-top">
            <div className="flex items-start justify-between p-4">
                <div className="rounded-xl bg-black/40 px-4 py-2 text-lg font-bold tabular-nums text-coin">
                    ● {coins}
                </div>
                <div className="text-center">
                    <p className="text-4xl font-black tabular-nums drop-shadow-md">{distance}m</p>
                    {best > 0 && (
                        <p className="text-[1.1rem] font-semibold uppercase tracking-wider text-white/60 drop-shadow">
                            best {best}m
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    className="pointer-events-auto rounded-xl bg-black/40 px-4 py-2 text-lg font-bold transition-transform active:scale-95"
                    onClick={() => store.patch({ quitConfirm: true })}
                >
                    ✕
                </button>
            </div>
            {/* Quit confirmation: freezes the game (GameCanvas watches
                quitConfirm) until the player decides. */}
            {quitConfirm && (
                <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/70 px-8">
                    <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl">
                        <p className="text-xl font-black">Quit this run?</p>
                        <p className="mt-2 text-[1.1rem] text-white/60">
                            Your distance and coins so far will be lost.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                className="flex-1 rounded-xl bg-white/10 px-6 py-3 font-bold transition-transform active:scale-95"
                                onClick={() => store.patch({ quitConfirm: false })}
                            >
                                Keep running
                            </button>
                            <button
                                type="button"
                                className="flex-1 rounded-xl bg-secondary px-6 py-3 font-black text-black transition-transform active:scale-95"
                                onClick={() => store.patch({ quitConfirm: false, phase: 'menu' })}
                            >
                                Quit
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {paused && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                    <p className="text-2xl font-bold">Paused</p>
                </div>
            )}
        </div>
    );
}
