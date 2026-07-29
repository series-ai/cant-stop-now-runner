import React from 'react';
import { createRoot } from 'react-dom/client';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import App from './ui/App.tsx';
import { store } from './state/store.ts';
import { loadSave, flushSave } from './state/save.ts';
import { initSdk, registerLifecycles, sdkReady } from './sdk/runSdk.ts';
import { warmAssets } from './assets/preload.ts';
import { refreshServerTime } from './shared/serverTime.ts';
import { initAudio, suspendAudio, resumeAudio } from './audio/audio.ts';
import './styles/app.css';

/**
 * Boot sequence. The ORDER here matters — it's the pattern production RUN
 * games use. Keep the numbered steps in this order.
 */
async function boot() {
    // 1. SDK first. Nothing may call RundotGameAPI before this resolves.
    //    Resolves even if init fails (local dev outside the RUN host).
    await initSdk();

    // 2. Load persisted progress before first render, so the menu shows the
    //    real best distance instead of popping it in after a beat.
    const save = await loadSave();
    store.patch({
        best: save.best,
        totalCoins: save.totalCoins,
        unlockedSkins: save.unlockedSkins,
        equippedSkin: save.equippedSkin,
        musicVolume: save.settings.music,
        sfxVolume: save.settings.sfx,
    });
    // Audio unlocks (and music starts) on the first tap — autoplay policy.
    initAudio(save.settings);

    // 3. Mount React. `phase` starts at 'loading', so this paints the
    //    loading screen (progress bar at 0%).
    createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    // 4. Lift the boot cover once the loading screen has actually painted
    //    (double-rAF = after the next rendered frame). Asset warming continues
    //    behind it — the player watches the progress bar, not a black screen.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById('boot-cover');
            if (!cover) return;
            cover.classList.add('hidden');
            setTimeout(() => cover.remove(), 400); // matches the CSS transition
        });
    });

    // 5. Warm all critical assets (see src/assets/manifest.ts). This game's
    //    art is procedural (src/game/textures.ts), so the manifest is empty
    //    and this resolves almost instantly — the plumbing stays in place for
    //    real art.
    await warmAssets((p) => store.patch({ loadProgress: p }));

    // 6. Loading done — hand over to the menu.
    store.patch({ phase: 'menu' });

    // 7. Host lifecycle hooks. Register AFTER boot so handlers never race
    //    half-initialized state.
    //    Rules: persist on onSleep, never rely on onQuit firing, and never
    //    fire fresh SDK RPCs (e.g. scheduling notifications) from
    //    onSleep/onQuit — a hard close kills the runtime before they land.
    registerLifecycles({
        onPause: () => {
            store.patch({ paused: true });
            suspendAudio();
        },
        onResume: () => {
            store.patch({ paused: false });
            resumeAudio();
            void refreshServerTime(); // keep the trusted clock fresh
        },
        onSleep: () => flushSave(),
        onAwake: () => { void refreshServerTime(); }, // long suspend → resample
        onQuit: () => flushSave(),
    });

    //    Browser fallback: outside the RUN host nothing fires onPause when
    //    the tab is hidden, so mirror it on visibilitychange (this also stops
    //    the music sequencer from garbling under background-tab timer
    //    throttling). Resume is guarded so a tab-show never restarts audio
    //    the host itself suspended.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) suspendAudio();
        else if (!store.get().paused) resumeAudio();
    });

    // 8. Post-boot, fire-and-forget work goes here — analytics boot event,
    //    server time refresh, notification re-arming. None of it should block
    //    or throw into this function.
    void refreshServerTime(); // trusted clock for the daily ad cap
    if (sdkReady()) {
        try {
            RundotGameAPI.analytics.recordCustomEvent('game_loaded').catch(() => {});
            RundotGameAPI.analytics.trackFunnelStep(1, 'game_loaded', 'boot', 1).catch(() => {});
        } catch (err) {
            console.warn('[Main] boot analytics failed', err);
        }
    }
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);
