/**
 * Tiny external store bridging game code (Pixi ticker, SDK callbacks, plain
 * modules) and React — no state-library dependency. Game code calls
 * store.patch(); React components subscribe with useStore(selector).
 *
 * Keep this store for UI-FACING state only (phase, HUD numbers, popups).
 * Per-frame simulation state stays inside the Pixi scene — patching the
 * store every frame re-renders React every frame.
 */
import { useSyncExternalStore } from 'react';

/** The UI-facing app state. */
export interface AppState {
    /**
     * loading → menu ⇄ shop/settings/leaderboard, menu → playing → gameover
     * (gameover keeps the canvas mounted so the overlay sits on the final
     * frame).
     */
    phase: 'loading' | 'menu' | 'shop' | 'settings' | 'leaderboard' | 'playing' | 'gameover';
    /** 0..1 progress of the critical-asset warm during 'loading' */
    loadProgress: number;
    /** Set by the host's onPause/onResume lifecycle hooks */
    paused: boolean;
    /** Quit confirmation dialog is up (freezes the game like a pause) */
    quitConfirm: boolean;
    /** Bumped to force a fresh scene mount — "Run Again" is a keyed remount */
    runId: number;
    /** Current run: distance in meters (patched on whole-meter ticks) */
    distance: number;
    /** Current run: coins collected */
    coins: number;
    /** All-time best distance in meters (from the save) */
    best: number;
    /** True right after a run that beat the previous best */
    newBest: boolean;
    /** Spendable coin wallet (from the save; the shop deducts from it) */
    totalCoins: number;
    /** True once this run's coins were doubled via the rewarded ad */
    coinsDoubled: boolean;
    /** Unlocked skin ids (from the save) */
    unlockedSkins: string[];
    /** Currently equipped skin id */
    equippedSkin: string;
    /** Music volume 0..1 (mirrored to the audio engine and the save) */
    musicVolume: number;
    /** Sound-effects volume 0..1 */
    sfxVolume: number;
    /** All-time leaderboard rank returned after this run's submit (host only) */
    lbRank: number | null;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: 'loading',
    loadProgress: 0,
    paused: false,
    quitConfirm: false,
    runId: 0,
    distance: 0,
    coins: 0,
    best: 0,
    newBest: false,
    totalCoins: 0,
    coinsDoubled: false,
    unlockedSkins: ['scout'],
    equippedSkin: 'scout',
    musicVolume: 0.6,
    sfxVolume: 0.8,
    lbRank: null,
};

export const store = {
    /** Read the current state (from game code; in React use useStore). */
    get: (): AppState => state,
    /** Shallow-merge a partial update and notify React subscribers. */
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const l of listeners) l();
    },
    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

/** Reset per-run fields and (re)enter the playing phase with a fresh scene. */
export function startRun(): void {
    store.patch({
        phase: 'playing',
        runId: store.get().runId + 1,
        distance: 0,
        coins: 0,
        newBest: false,
        coinsDoubled: false,
        quitConfirm: false,
        lbRank: null,
    });
}

/**
 * React hook. IMPORTANT: the selector must return a primitive or a stable
 * reference (e.g. s => s.phase). Returning a fresh object/array each call
 * makes React re-render forever.
 */
export function useStore<T = AppState>(
    selector: (s: AppState) => T = (s) => s as unknown as T
): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
