/**
 * Settings: music and sound volume sliders. Slider input updates the audio
 * engine and the store live; the save persist is debounced (state/save.ts).
 * A small blip on sound-slider release lets the player hear the new level.
 */
import { store, useStore } from '../state/store.ts';
import { setSettings } from '../state/save.ts';
import { setMusicVolume, setSfxVolume, sfx } from '../audio/audio.ts';

function VolumeRow({ label, value, onChange, onCommit }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    onCommit?: () => void;
}) {
    return (
        <div className="rounded-2xl bg-white/5 px-6 py-5">
            <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{label}</p>
                <p className="text-[1.1rem] tabular-nums text-white/50">{Math.round(value * 100)}%</p>
            </div>
            <input
                type="range"
                min={0}
                max={100}
                value={Math.round(value * 100)}
                className="mt-3 h-2 w-full cursor-pointer accent-primary"
                onChange={(e) => onChange(Number(e.target.value) / 100)}
                onPointerUp={onCommit}
                aria-label={`${label} volume`}
            />
        </div>
    );
}

export default function Settings() {
    const music = useStore((s) => s.musicVolume);
    const sound = useStore((s) => s.sfxVolume);

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
                <h2 className="text-2xl font-black tracking-wide">SETTINGS</h2>
                <div className="w-12" />
            </div>
            <div className="space-y-4 px-4">
                <VolumeRow
                    label="Music"
                    value={music}
                    onChange={(v) => {
                        store.patch({ musicVolume: v });
                        setMusicVolume(v);
                        setSettings({ music: v });
                    }}
                />
                <VolumeRow
                    label="Sound"
                    value={sound}
                    onChange={(v) => {
                        store.patch({ sfxVolume: v });
                        setSfxVolume(v);
                        setSettings({ sfx: v });
                    }}
                    onCommit={() => sfx.coin()}
                />
            </div>
        </div>
    );
}
