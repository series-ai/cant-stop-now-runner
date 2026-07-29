/**
 * Skin shop: a scrolling list of every skin in the catalog (game/skins.ts),
 * each previewed with the ACTUAL character art (game/skinPreviews.ts renders
 * the real player texture per skin) doing a synchronized run-cycle bob (the
 * .skin-bob keyframes in app.css — all rows share one timeline). Buy with
 * the coin wallet, equip anything owned. All mutations go through
 * state/save.ts and are patched back into the store so the UI (and the next
 * run's player texture) stay in sync.
 *
 * Scrolling note: body has touch-action: none (the game needs raw pointer
 * input), so the list opts back into vertical panning with touch-pan-y.
 */
import { useEffect, useState } from 'react';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { store, useStore } from '../state/store.ts';
import { buySkin, equipSkin } from '../state/save.ts';
import { SKINS, cssColor, type Skin } from '../game/skins.ts';
import { getSkinPreviews } from '../game/skinPreviews.ts';
import { sdkReady } from '../sdk/runSdk.ts';
import { sfx } from '../audio/audio.ts';

function SkinRow({ skin, preview, owned, equipped, wallet }: {
    skin: Skin;
    preview: string | null;
    owned: boolean;
    equipped: boolean;
    wallet: number;
}) {
    const affordable = wallet >= skin.cost;

    const onBuy = () => {
        const result = buySkin(skin.id, skin.cost);
        if (!result) return;
        sfx.purchase();
        store.patch({
            totalCoins: result.totalCoins,
            unlockedSkins: result.unlockedSkins,
            equippedSkin: result.equippedSkin, // buying auto-equips
        });
        if (sdkReady()) {
            try {
                RundotGameAPI.analytics.recordCustomEvent('skin_purchased', {
                    id: skin.id, cost: skin.cost,
                }).catch(() => {});
            } catch { /* non-fatal */ }
        }
    };

    const onEquip = () => {
        if (equipSkin(skin.id)) {
            sfx.click();
            store.patch({ equippedSkin: skin.id });
        }
    };

    return (
        <div className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${equipped ? 'bg-primary/15 outline outline-primary/40' : 'bg-white/5'}`}>
            <div className="flex h-16 w-14 shrink-0 items-end justify-center">
                {preview ? (
                    <img
                        src={preview}
                        alt={skin.name}
                        draggable={false}
                        className="skin-bob h-14 w-auto select-none"
                    />
                ) : (
                    // Palette placeholder for the first frames while the real
                    // character previews render.
                    <div
                        className="mb-1 h-12 w-12 rounded-full"
                        style={{ background: cssColor(skin.body) }}
                    />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{skin.name}</p>
                <p className="text-[1.1rem] text-white/50">
                    {equipped ? 'Equipped' : owned ? 'Owned' : <span className="text-coin">● {skin.cost}</span>}
                </p>
            </div>
            {equipped ? (
                <span className="rounded-xl px-4 py-2 text-[1.1rem] font-bold text-primary">✓</span>
            ) : owned ? (
                <button
                    type="button"
                    className="rounded-xl bg-white/10 px-4 py-2 text-[1.1rem] font-bold transition-transform active:scale-95"
                    onClick={onEquip}
                >
                    Equip
                </button>
            ) : (
                <button
                    type="button"
                    disabled={!affordable}
                    className={`rounded-xl px-4 py-2 text-[1.1rem] font-bold transition-transform ${affordable
                        ? 'bg-primary text-black active:scale-95'
                        : 'bg-white/5 text-white/30'}`}
                    onClick={onBuy}
                >
                    Buy
                </button>
            )}
        </div>
    );
}

export default function Shop() {
    const wallet = useStore((s) => s.totalCoins);
    const unlocked = useStore((s) => s.unlockedSkins);
    const equipped = useStore((s) => s.equippedSkin);
    const [previews, setPreviews] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        let alive = true;
        getSkinPreviews().then((p) => { if (alive) setPreviews(p); });
        return () => { alive = false; };
    }, []);

    return (
        <div className="flex h-full flex-col pt-safe-top">
            <div className="flex items-center justify-between p-4">
                <button
                    type="button"
                    className="rounded-xl bg-white/10 px-4 py-2 text-lg font-bold transition-transform active:scale-95"
                    onClick={() => { sfx.click(); store.patch({ phase: 'menu' }); }}
                >
                    ←
                </button>
                <h2 className="text-2xl font-black tracking-wide">SHOP</h2>
                <div className="rounded-xl bg-black/40 px-4 py-2 text-lg font-bold tabular-nums text-coin">
                    ● {wallet}
                </div>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-4 pb-safe-bottom">
                {SKINS.map((skin) => (
                    <SkinRow
                        key={skin.id}
                        skin={skin}
                        preview={previews?.[skin.id] ?? null}
                        owned={unlocked.includes(skin.id)}
                        equipped={equipped === skin.id}
                        wallet={wallet}
                    />
                ))}
            </div>
        </div>
    );
}
