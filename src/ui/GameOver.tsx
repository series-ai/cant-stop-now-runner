/**
 * Game-over overlay, shown above the frozen final frame of the run. "Retry"
 * restarts via startRun() — a keyed remount of GameCanvas (App.tsx).
 *
 * Coin doubling goes through the ads system (systems/ads.ts via sdk/ads.ts):
 * confirmation dialog → grantReward — a rewarded ad where ads exist (instant
 * for no-ads subscribers, RunBucks fallback on no-ads platforms), all under
 * the shared 15/day cap. Offered only when the run earned at least
 * CONFIG.ads.minCoinsToDouble.
 */
import { useEffect, useState } from 'react';
import { store, startRun, useStore } from '../state/store.ts';
import { addBonusCoins } from '../state/save.ts';
import { adsSystem } from '../sdk/ads.ts';
import { formatCountdown } from '../shared/serverTime.ts';
import { CONFIG } from '../game/config.ts';
import { sfx } from '../audio/audio.ts';

type AdFlow = 'idle' | 'confirm' | 'watching';

export default function GameOver() {
    const distance = useStore((s) => s.distance);
    const coins = useStore((s) => s.coins);
    const best = useStore((s) => s.best);
    const newBest = useStore((s) => s.newBest);
    const doubled = useStore((s) => s.coinsDoubled);
    const lbRank = useStore((s) => s.lbRank);
    const [adFlow, setAdFlow] = useState<AdFlow>('idle');
    const [adReady, setAdReady] = useState(true);
    const [failNote, setFailNote] = useState<string | null>(null);

    const ads = adsSystem();
    const offerable = coins >= CONFIG.ads.minCoinsToDouble && !doubled;
    const capped = ads.capReached();

    // Probe ad fill for the button's disabled state (ad platforms only — the
    // RunBucks fallback needs no probe, and subscribers always pass).
    useEffect(() => {
        if (!offerable || capped || !ads.adsCapability()) return;
        let alive = true;
        ads.isAvailable().then((ok) => { if (alive) setAdReady(ok); });
        return () => { alive = false; };
    }, [offerable, capped, ads]);

    const confirmDouble = async () => {
        setAdFlow('watching');
        setFailNote(null);
        await ads.grantReward({
            productId: 'bonus_double_coins', // platform catalog id (no-ads fallback)
            description: 'Double your run coins',
            trigger: 'gameover_double_coins',
            name: 'Double Coins',
            onReward: () => {
                // The base coins are already in the wallet (recordRun), so
                // grant the delta and mark the run as doubled.
                const bonus = store.get().coins;
                const wallet = addBonusCoins(bonus);
                store.patch({ coins: bonus * 2, totalCoins: wallet, coinsDoubled: true });
                sfx.purchase();
            },
            onFailed: (reason) => {
                if (reason === 'cancelled') return; // player declined the spend dialog
                setFailNote(reason === 'cap_reached'
                    ? 'Daily ad limit reached'
                    : 'Ad not available right now');
            },
        });
        setAdFlow('idle');
    };

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/60 px-10 pt-safe-top pb-safe-bottom">
            <div className="text-center">
                {newBest ? (
                    <p className="animate-bounce text-2xl font-black uppercase tracking-wider text-primary">
                        ★ New best! ★
                    </p>
                ) : (
                    <p className="text-2xl font-black uppercase tracking-wider text-white/70">
                        Wiped out!
                    </p>
                )}
                <p className="mt-3 text-6xl font-black tabular-nums drop-shadow-lg">{distance}m</p>
                <p className="mt-2 text-[1.1rem] text-white/50">best {best}m</p>
                {lbRank !== null && (
                    <p className="mt-1 text-[1.1rem] font-semibold text-tertiary">
                        #{lbRank} all time
                    </p>
                )}
                <div className="mt-4 space-y-1 text-xl font-bold tabular-nums">
                    <p>
                        <span className="text-coin">● {doubled ? coins / 2 : coins}</span>
                        <span className="ml-2 text-white/50">this run</span>
                    </p>
                    {doubled && (
                        <>
                            <p>
                                <span className="text-coin">● {coins / 2}</span>
                                <span className="ml-2 text-white/50">ad bonus</span>
                            </p>
                            <hr className="mx-auto my-1.5 w-44 border-white/20" />
                            <p>
                                <span className="text-coin">● {coins}</span>
                                <span className="ml-2 text-white/50">total</span>
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="flex w-full flex-col items-center gap-3">
                {offerable && (capped ? (
                    <p className="text-[1.1rem] text-white/50">
                        Daily ad limit reached, resets in {formatCountdown(ads.msUntilCapReset())}
                    </p>
                ) : (
                    <>
                        <button
                            type="button"
                            disabled={adFlow === 'watching' || !adReady}
                            className="rounded-2xl bg-coin px-8 py-3 text-lg font-black text-black shadow-lg transition-transform active:scale-95 disabled:opacity-60"
                            onClick={() => setAdFlow('confirm')}
                        >
                            {adFlow === 'watching' ? 'Playing ad…'
                                : adReady ? `▶ Double coins (+${coins})` : 'No ad available'}
                        </button>
                        <p className="text-[1.1rem] tabular-nums text-white/35">
                            {ads.remainingToday()}/{ads.maxPerDay} ads left today
                        </p>
                    </>
                ))}
                {failNote && <p className="text-[1.1rem] text-white/50">{failNote}</p>}
                <div className="-mx-4 flex w-[calc(100%+2rem)] max-w-md gap-3">
                    <button
                        type="button"
                        className="flex-1 rounded-2xl bg-secondary py-4 text-xl font-black text-black shadow-lg transition-transform active:scale-95"
                        onClick={() => { sfx.click(); store.patch({ phase: 'menu' }); }}
                    >
                        HOME
                    </button>
                    <button
                        type="button"
                        className="flex-1 rounded-2xl bg-primary py-4 text-xl font-black text-black shadow-lg transition-transform active:scale-95"
                        onClick={() => { sfx.click(); startRun(); }}
                    >
                        RETRY
                    </button>
                </div>
            </div>

            {adFlow === 'confirm' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 px-8">
                    <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl">
                        <p className="text-xl font-black">Double your coins?</p>
                        <p className="mt-2 text-[1.1rem] text-white/60">
                            {ads.adsCapability()
                                ? <>Watch a short ad to turn <span className="text-coin">● {coins}</span> into <span className="text-coin">● {coins * 2}</span>.</>
                                : <>Turn <span className="text-coin">● {coins}</span> into <span className="text-coin">● {coins * 2}</span> for a small RunBucks charge.</>}
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                type="button"
                                className="rounded-xl bg-white/10 px-6 py-3 font-bold transition-transform active:scale-95"
                                onClick={() => setAdFlow('idle')}
                            >
                                No thanks
                            </button>
                            <button
                                type="button"
                                className="rounded-xl bg-coin px-6 py-3 font-black text-black transition-transform active:scale-95"
                                onClick={confirmDouble}
                            >
                                {ads.adsCapability() ? 'Watch ad' : 'Double it'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
