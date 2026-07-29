/**
 * Leaderboard wrapper: an all-time board with simple security (see
 * rundot/leaderboard.config.json — the board is created automatically on
 * `rundot deploy`; delete that file if your game has no leaderboard).
 *
 * ADAPT: the submitted score here is DISTANCE IN METERS (higher = better).
 * Submit whatever number your game competes on, adjust the config's
 * min/maxScore bounds to match, and update the "m" suffix in
 * ui/Leaderboard.tsx. Want daily/weekly boards too? Add periods to the
 * config and pass the period key when fetching.
 *
 * Posture: leaderboards only exist inside the RUN host. In plain-browser
 * dev every call resolves to null/no-op and the UI shows its offline
 * state. Nothing here ever throws.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { sdkReady } from './runSdk.ts';

/** The all-time period key from rundot/leaderboard.config.json. */
const PERIOD = 'alltime';

/** True when the RUN host is present (boards can exist at all). */
export function leaderboardsAvailable(): boolean {
    return sdkReady();
}

/**
 * Submit a finished run. The server keeps each player's best score, so
 * every run can be submitted. Resolves to the player's new all-time rank
 * when the submission was accepted AND ranked, else null.
 */
export async function submitRunScore(score: number, seconds: number): Promise<number | null> {
    if (!sdkReady() || score <= 0) return null;
    try {
        const result = await RundotGameAPI.leaderboard.submitScore({
            score,
            duration: Math.max(1, seconds),
        });
        return result.accepted ? result.rank ?? null : null;
    } catch (err) {
        console.warn('[leaderboard] submit failed', err);
        return null;
    }
}

/** One row of the board view. */
export interface BoardEntry {
    profileId: string;
    username: string;
    avatarUrl: string | null;
    rank: number | null;
    score: number;
}

/** Everything the leaderboard screen renders, in one shape. */
export interface BoardView {
    /** Top entries (up to 10). */
    top: BoardEntry[];
    /** The player's own entry (null if they have no ranked score yet). */
    you: BoardEntry | null;
    /** Neighbors around the player, when they are outside the top list. */
    before: BoardEntry[];
    after: BoardEntry[];
    totalPlayers: number;
}

function toEntry(e: {
    profileId: string; username: string; avatarUrl: string | null;
    rank: number | null; score: number;
}): BoardEntry {
    return {
        profileId: e.profileId,
        username: e.username,
        avatarUrl: e.avatarUrl,
        rank: e.rank,
        score: e.score,
    };
}

/**
 * Fetch the all-time board: top 10 plus the player's surroundings, in one
 * host call. Null on failure or outside the host (UI shows offline/error).
 */
export async function fetchBoard(): Promise<BoardView | null> {
    if (!sdkReady()) return null;
    try {
        const r = await RundotGameAPI.leaderboard.getPodiumScores({
            period: PERIOD,
            topCount: 10,
            contextAhead: 2,
            contextBehind: 2,
        });
        return {
            top: r.context.topEntries.map(toEntry),
            you: r.context.playerEntry ? toEntry(r.context.playerEntry) : null,
            before: r.context.beforePlayer.map(toEntry),
            after: r.context.afterPlayer.map(toEntry),
            totalPlayers: r.totalEntries,
        };
    } catch (err) {
        console.warn('[leaderboard] fetch failed', err);
        return null;
    }
}
