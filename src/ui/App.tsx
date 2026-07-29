/**
 * Screen router. One phase visible at a time; 'playing' and 'gameover' both
 * keep the Pixi canvas mounted — game over is an overlay above the final
 * frame of the run. The canvas is keyed by runId so "Run Again" remounts a
 * fresh scene (see startRun in state/store.ts).
 *
 * #app-frame (styled in styles/app.css) is the device frame: a centered
 * portrait column that fills phones edge-to-edge and letterboxes on desktop.
 * Everything — canvas and DOM UI — lives inside it, so they always align.
 */
import { useStore } from '../state/store.ts';
import LoadingScreen from './LoadingScreen.tsx';
import MainMenu from './MainMenu.tsx';
import Shop from './Shop.tsx';
import Settings from './Settings.tsx';
import Leaderboard from './Leaderboard.tsx';
import Hud from './Hud.tsx';
import GameOver from './GameOver.tsx';
import GameCanvas from '../game/GameCanvas.tsx';

export default function App() {
    const phase = useStore((s) => s.phase);
    const runId = useStore((s) => s.runId);
    return (
        <div id="app-frame" className="bg-surface text-white">
            {phase === 'loading' && <LoadingScreen />}
            {phase === 'menu' && <MainMenu />}
            {phase === 'shop' && <Shop />}
            {phase === 'settings' && <Settings />}
            {phase === 'leaderboard' && <Leaderboard />}
            {(phase === 'playing' || phase === 'gameover') && (
                <div className="absolute inset-0">
                    <GameCanvas key={runId} />
                    {phase === 'playing' && <Hud />}
                    {phase === 'gameover' && <GameOver />}
                </div>
            )}
        </div>
    );
}
