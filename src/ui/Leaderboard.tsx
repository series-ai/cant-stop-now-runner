/**
 * All-time leaderboard screen: the top 10 as uniform rows (medal emoji and
 * gold/silver/bronze outlined backers for the top three) and, when the
 * player sits outside the top, their own neighborhood with their row
 * highlighted. Data comes from sdk/leaderboard.ts in one host call.
 *
 * ADAPT: scores render with an "m" (meters) suffix — change it where
 * marked if your game competes on something else.
 *
 * Leaderboards only exist inside the RUN host, so plain-browser dev shows
 * the offline state.
 */
import { useEffect, useState } from 'react';
import { store, useStore } from '../state/store.ts';
import { fetchBoard, leaderboardsAvailable, type BoardEntry, type BoardView } from '../sdk/leaderboard.ts';
import { sfx } from '../audio/audio.ts';

/** ADAPT: how a score is displayed everywhere on this screen. */
const fmtScore = (score: number) => `${score}m`;

function Avatar({ entry, size }: { entry: BoardEntry; size: string }) {
    if (entry.avatarUrl) {
        return (
            <img
                src={entry.avatarUrl}
                alt=""
                draggable={false}
                className={`${size} shrink-0 rounded-full bg-white/10 object-cover`}
            />
        );
    }
    return (
        <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-white/10 font-black`}>
            {(entry.username || '?').charAt(0).toUpperCase()}
        </div>
    );
}

/** Gold / silver / bronze outline for the top three rows. */
function medalOutline(rank: number | null): string | null {
    if (rank === 1) return 'outline-2 outline-amber-300';
    if (rank === 2) return 'outline-2 outline-slate-300';
    if (rank === 3) return 'outline-2 outline-amber-600';
    return null;
}

function Row({ entry, highlight }: { entry: BoardEntry; highlight: boolean }) {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
    const outline = medalOutline(entry.rank);
    const backer = highlight
        ? `bg-primary/15 outline ${outline ?? 'outline-primary/40'}`
        : outline
            ? `bg-white/10 outline ${outline}`
            : 'bg-white/5';
    return (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${backer}`}>
            {medal ? (
                <span className="w-10 shrink-0 text-center text-2xl">{medal}</span>
            ) : (
                <span className="w-10 shrink-0 text-right font-black tabular-nums text-white/60">
                    {entry.rank ?? '–'}
                </span>
            )}
            <Avatar entry={entry} size="h-9 w-9" />
            <span className="min-w-0 flex-1 truncate font-bold">
                {entry.username}
                {highlight && <span className="ml-2 text-[1.1rem] font-semibold text-primary">you</span>}
            </span>
            <span className="shrink-0 font-black tabular-nums text-coin">{fmtScore(entry.score)}</span>
        </div>
    );
}

export default function Leaderboard() {
    const best = useStore((s) => s.best);
    const [board, setBoard] = useState<BoardView | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'offline' | 'error'>(
        leaderboardsAvailable() ? 'loading' : 'offline'
    );

    useEffect(() => {
        if (!leaderboardsAvailable()) return;
        let alive = true;
        fetchBoard().then((b) => {
            if (!alive) return;
            if (b) { setBoard(b); setState('ready'); }
            else setState('error');
        });
        return () => { alive = false; };
    }, []);

    const youId = board?.you?.profileId ?? null;
    const youInTop = !!(youId && board?.top.some((e) => e.profileId === youId));

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
                <div className="text-center">
                    <h2 className="text-2xl font-black tracking-wide">LEADERBOARD</h2>
                    <p className="text-[1.1rem] uppercase tracking-widest text-white/50">all time</p>
                </div>
                <div className="w-12" />
            </div>

            {/* pt-1: outlines draw outside the box; without top padding the
                first row's medal outline is clipped by overflow-y-auto. */}
            <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-4 pt-1 pb-safe-bottom">
                {state === 'offline' && (
                    <div className="rounded-2xl bg-white/5 px-6 py-10 text-center text-lg text-white/60">
                        <p className="text-3xl">🏆</p>
                        <p className="mt-3">Leaderboards are available in the RUN app.</p>
                        {best > 0 && (
                            <p className="mt-2 text-white/40">Your best so far: {fmtScore(best)}</p>
                        )}
                    </div>
                )}
                {state === 'loading' && (
                    <p className="px-6 py-10 text-center text-lg text-white/50">Loading…</p>
                )}
                {state === 'error' && (
                    <div className="rounded-2xl bg-white/5 px-6 py-10 text-center text-lg text-white/60">
                        <p>Could not load the leaderboard.</p>
                        <p className="mt-2 text-white/40">Check your connection and try again.</p>
                    </div>
                )}
                {state === 'ready' && board && board.top.length === 0 && (
                    <div className="rounded-2xl bg-white/5 px-6 py-10 text-center text-lg text-white/60">
                        <p className="text-3xl">🏆</p>
                        <p className="mt-3">No scores on the board yet. Be the first!</p>
                    </div>
                )}
                {state === 'ready' && board && board.top.length > 0 && (
                    <>
                        <div className="space-y-2">
                            {board.top.map((e) => (
                                <Row key={e.profileId} entry={e} highlight={e.profileId === youId} />
                            ))}
                        </div>
                        {board.you && !youInTop && (
                            <>
                                <p className="text-center font-black text-white/30">···</p>
                                <div className="space-y-2">
                                    {board.before.map((e) => (
                                        <Row key={e.profileId} entry={e} highlight={false} />
                                    ))}
                                    <Row entry={board.you} highlight />
                                    {board.after.map((e) => (
                                        <Row key={e.profileId} entry={e} highlight={false} />
                                    ))}
                                </div>
                            </>
                        )}
                        <p className="pb-2 text-center text-[1.1rem] text-white/40">
                            {board.totalPlayers} players on the board
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
