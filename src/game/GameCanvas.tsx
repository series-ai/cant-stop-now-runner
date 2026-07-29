/**
 * React ↔ Pixi boundary. React owns WHEN the game exists (mount/unmount with
 * the 'playing'/'gameover' phases); Pixi owns everything inside the canvas.
 * No React state flows in per-frame — game → UI communication goes through
 * the store. App.tsx keys this component by store.runId, so "Run Again" is a
 * clean unmount/remount — the scene never needs a reset path.
 *
 * StrictMode-safe: dev double-mount is handled by the `disposed` flag (the
 * first mount's async init resolves, sees it was cancelled, and destroys its
 * app before the second mount's app appears).
 */
import { useEffect, useRef } from 'react';
import type { Application } from 'pixi.js';
import { createPixiApp } from './pixiApp.ts';
import { createStage, type Stage } from './stage.ts';
import { createRunnerScene, type Scene } from './runnerScene.ts';
import { store, useStore } from '../state/store.ts';

export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);
    // Host pause and the quit-confirmation dialog both freeze the game.
    const frozen = useStore((s) => s.paused || s.quitConfirm);

    useEffect(() => {
        let disposed = false;
        let scene: Scene | null = null;
        let stage: Stage | null = null;
        (async () => {
            // hostRef is always attached by the time the effect runs.
            const app = await createPixiApp(hostRef.current!);
            if (disposed) {
                app.destroy({ removeView: true }, { children: true });
                return;
            }
            appRef.current = app;
            // Design-resolution stage: scenes position in design units, not
            // pixels, so layout is proportional on every device (stage.ts).
            stage = createStage(app);
            scene = createRunnerScene(app, stage);
            // Respect a pause that landed while the canvas was initializing.
            if (store.get().paused || store.get().quitConfirm) app.ticker.stop();
        })();
        return () => {
            disposed = true;
            try { scene?.destroy(); } catch { /* scene already torn down */ }
            try { stage?.destroy(); } catch { /* stage already torn down */ }
            if (appRef.current) {
                appRef.current.destroy({ removeView: true }, { children: true });
                appRef.current = null;
            }
        };
    }, []);

    // Pause (host lifecycle or quit dialog) → freeze/unfreeze the ticker.
    useEffect(() => {
        const app = appRef.current;
        if (!app) return;
        if (frozen) app.ticker.stop();
        else app.ticker.start();
    }, [frozen]);

    return <div ref={hostRef} className="absolute inset-0" />;
}
