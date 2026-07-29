/**
 * Main menu: title, personal best, coin wallet, the Play/Shop buttons, and
 * the settings gear.
 */
import { store, startRun, useStore } from '../state/store.ts';
import { SKINS } from '../game/skins.ts';
import { sfx } from '../audio/audio.ts';

export default function MainMenu() {
    const best = useStore((s) => s.best);
    const totalCoins = useStore((s) => s.totalCoins);
    const unlockedSkins = useStore((s) => s.unlockedSkins);
    // The shop has something affordable and unowned: nudge with a badge.
    const shopBadge = SKINS.some(
        (s) => !unlockedSkins.includes(s.id) && s.cost <= totalCoins
    );
    return (
        <div className="relative flex h-full flex-col items-center justify-center gap-8 px-10 pt-safe-top pb-safe-bottom">
            <button
                type="button"
                aria-label="Settings"
                style={{ top: 'calc(1rem + var(--safe-top))' }}
                className="absolute right-4 rounded-xl bg-white/10 px-4 py-2 text-xl transition-transform active:scale-95"
                onClick={() => { sfx.click(); store.patch({ phase: 'settings' }); }}
            >
                ⚙
            </button>
            <div className="text-center">
                {/* ADAPT: your game's title and tagline */}
                <h1 className="text-5xl font-black tracking-tight text-primary drop-shadow-lg">
                    ENDLESS RUNNER
                </h1>
                <p className="mt-2 text-[1.1rem] uppercase tracking-[0.3em] text-white/50">
                    template
                </p>
            </div>

            <div className="flex gap-6 text-center">
                <div className="rounded-2xl bg-white/5 px-6 py-3">
                    <p className="text-[1.1rem] uppercase tracking-wider text-white/50">Best</p>
                    <p className="text-2xl font-bold tabular-nums">{best}m</p>
                </div>
                <div className="rounded-2xl bg-white/5 px-6 py-3">
                    <p className="text-[1.1rem] uppercase tracking-wider text-white/50">Coins</p>
                    <p className="text-2xl font-bold tabular-nums text-coin">● {totalCoins}</p>
                </div>
            </div>

            <div className="flex flex-col items-center gap-3">
                <button
                    type="button"
                    className="w-56 rounded-2xl bg-primary py-4 text-2xl font-black text-black shadow-lg transition-transform active:scale-95"
                    onClick={() => { sfx.click(); startRun(); }}
                >
                    RUN
                </button>
                <button
                    type="button"
                    className="relative w-56 rounded-2xl bg-secondary py-4 text-2xl font-black text-black shadow-lg transition-transform active:scale-95"
                    onClick={() => { sfx.click(); store.patch({ phase: 'shop' }); }}
                >
                    SHOP
                    {shopBadge && (
                        <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-lg font-black text-white shadow-lg">
                            !
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className="w-56 rounded-2xl bg-tertiary py-4 text-2xl font-black text-black shadow-lg transition-transform active:scale-95"
                    onClick={() => { sfx.click(); store.patch({ phase: 'leaderboard' }); }}
                >
                    LEADERBOARD
                </button>
            </div>

            {/* ADAPT: your controls, short imperative lines (see CLAUDE.md UI Copy Style) */}
            <div className="w-full max-w-xs space-y-1.5 rounded-2xl bg-white/5 px-6 py-4 text-center text-lg text-white/60">
                <p>Tap to jump</p>
                <p>Tap in the air to double jump</p>
                <p>Quick tap for a hop</p>
            </div>
        </div>
    );
}
