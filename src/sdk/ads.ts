/**
 * This game's rewarded-ads instance: systems/ads.ts (the reusable core —
 * daily cap, subscriber instant-grant, RunBucks fallback on no-ads
 * platforms) wired to this game's save and analytics.
 *
 * Lazy singleton: created on first use, which is always after boot — so the
 * debugFakeAds decision (fake ads in plain-browser dev, real ads in the RUN
 * host) sees the settled SDK state.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { createAds, type AdsSystem } from '../systems/ads.ts';
import { getSave, flushSave } from '../state/save.ts';
import { sdkReady } from './runSdk.ts';
import { CONFIG } from '../game/config.ts';

let _ads: AdsSystem | null = null;

export function adsSystem(): AdsSystem {
    if (_ads) return _ads;
    _ads = createAds({
        getState: () => getSave().ads,
        maxPerDay: CONFIG.ads.maxPerDay,
        persist: () => flushSave(),
        // Plain-browser dev has no host to serve ads: fake the watch so the
        // reward flow stays testable. Inside the RUN host this is always
        // false (sdkReady() is true there).
        debugFakeAds: !sdkReady(),
        analytics: {
            onRewardGranted: ({ trigger, method }) => {
                if (!sdkReady()) return;
                try {
                    RundotGameAPI.analytics.recordCustomEvent('ad_reward_granted', { trigger, method })
                        .catch(() => {});
                } catch { /* non-fatal */ }
            },
            onRewardFailed: ({ trigger, reason }) => {
                if (!sdkReady()) return;
                try {
                    RundotGameAPI.analytics.recordCustomEvent('ad_reward_failed', { trigger, reason })
                        .catch(() => {});
                } catch { /* non-fatal */ }
            },
        },
    });
    return _ads;
}
