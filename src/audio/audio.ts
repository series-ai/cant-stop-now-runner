/**
 * Procedural audio: synthesized SFX and a sequenced chiptune music loop via
 * WebAudio — no audio files, matching the game's zero-asset approach. Two
 * buses (music, sfx) with independent volumes persisted in the save.
 *
 * Autoplay policy: the AudioContext is created/resumed on the first user
 * gesture (initAudio attaches one-time listeners); everything before that
 * is silently dropped.
 *
 * ADAPT — swapping in real audio files: keep the two buses and the volume
 * API, and only replace the sound-producing layer.
 *   - SFX: fetch + decodeAudioData small files (public/audio/) at boot,
 *     then have each named sfx.* function play its AudioBufferSourceNode
 *     into sfxBus — call sites never change.
 *   - Music: replace the sequencer in startMusic() with a looping buffer
 *     source (loop = true) into musicBus. Music files are big — serve them
 *     from public/cdn-assets/ via RundotGameAPI.cdn.fetchAsset().
 *   - Or just retune the synth: the music is data (TEMPO, BASS_ROOTS,
 *     MELODY note arrays) and each sfx.* is a couple of tone()/noise()
 *     calls.
 */

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;

let musicVolume = 0.6;
let sfxVolume = 0.8;

/** Base gains keep synthesized peaks comfortably below clipping. */
const MUSIC_BASE = 0.5;
const SFX_BASE = 0.6;

function ensureCtx(): AudioContext | null {
    if (ctx) return ctx;
    try {
        ctx = new AudioContext();
        musicBus = ctx.createGain();
        musicBus.gain.value = musicVolume * MUSIC_BASE;
        musicBus.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = sfxVolume * SFX_BASE;
        sfxBus.connect(ctx.destination);
    } catch {
        return null; // no WebAudio — the game plays silently
    }
    return ctx;
}

/**
 * Call once at boot with the saved volumes. Attaches one-time gesture
 * listeners that unlock audio and start the music loop.
 */
export function initAudio(volumes: { music: number; sfx: number }): void {
    musicVolume = volumes.music;
    sfxVolume = volumes.sfx;
    const unlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        const c = ensureCtx();
        if (!c) return;
        if (c.state === 'suspended') c.resume().catch(() => {});
        startMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
}

export function setMusicVolume(v: number): void {
    musicVolume = v;
    if (musicBus) musicBus.gain.value = v * MUSIC_BASE;
}

export function setSfxVolume(v: number): void {
    sfxVolume = v;
    if (sfxBus) sfxBus.gain.value = v * SFX_BASE;
}

/** Host lifecycle: freeze all audio with the game. */
export function suspendAudio(): void {
    ctx?.suspend().catch(() => {});
}

export function resumeAudio(): void {
    ctx?.resume().catch(() => {});
}

// ---------------------------------------------------------------------------
// SFX synthesis helpers
// ---------------------------------------------------------------------------

/** One oscillator with a pitch sweep and an exponential-decay envelope. */
function tone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    volume: number,
    delay = 0
): void {
    const c = ctx;
    if (!c || !sfxBus) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    env.gain.setValueAtTime(volume, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(env);
    env.connect(sfxBus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

/** Short filtered noise burst (thuds, hats, crashes). */
function noise(duration: number, volume: number, filterHz: number, delay = 0): void {
    const c = ctx;
    if (!c || !sfxBus) return;
    const t0 = c.currentTime + delay;
    const length = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const env = c.createGain();
    env.gain.setValueAtTime(volume, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(sfxBus);
    src.start(t0);
}

/** Game SFX. Safe to call anytime; silent before the first user gesture. */
export const sfx = {
    /** Jump (and double jump, a fifth higher so the pair reads musically). */
    jump(second = false): void {
        tone('square', second ? 450 : 300, second ? 900 : 600, 0.09, 0.5);
    },
    land(): void {
        noise(0.06, 0.25, 700);
    },
    coin(): void {
        tone('sine', 1320, 1320, 0.05, 0.5);
        tone('sine', 1760, 1760, 0.09, 0.5, 0.05);
    },
    death(): void {
        tone('sawtooth', 400, 60, 0.5, 0.5);
        noise(0.3, 0.35, 900, 0.05);
    },
    click(): void {
        tone('sine', 900, 700, 0.04, 0.35);
    },
    purchase(): void {
        tone('square', 660, 660, 0.07, 0.35);
        tone('square', 880, 880, 0.07, 0.35, 0.07);
        tone('square', 1320, 1320, 0.12, 0.35, 0.14);
    },
};

// ---------------------------------------------------------------------------
// Music: a bright 8-bit runner loop (C - G - Am - F, two melody passes)
// ---------------------------------------------------------------------------

const TEMPO = 132;
const STEP = 60 / TEMPO / 2; // 8th notes
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Chord roots (MIDI): C2, G1, A1, F1 — each held for 8 steps.
const BASS_ROOTS = [36, 31, 33, 29];

// Two 32-step melody passes (MIDI note or 0 = rest), C-major pentatonic.
const MELODY: number[] = [
    // pass A
    72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 76, 0, 0,
    69, 0, 72, 0, 76, 0, 72, 0, 77, 76, 74, 0, 72, 0, 0, 0,
    // pass B
    72, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 79, 81, 84, 0,
    81, 0, 79, 0, 76, 0, 74, 0, 72, 74, 76, 74, 72, 0, 0, 0,
];
const LOOP_STEPS = MELODY.length;

let musicTimer: ReturnType<typeof setInterval> | null = null;
let nextStepTime = 0;
let stepIndex = 0;

function scheduleMusicNote(type: OscillatorType, midi: number, t: number, dur: number, vol: number): void {
    const c = ctx;
    if (!c || !musicBus) return;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.value = mtof(midi);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env);
    env.connect(musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

function scheduleHat(t: number): void {
    const c = ctx;
    if (!c || !musicBus) return;
    const length = Math.floor(c.sampleRate * 0.03);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const env = c.createGain();
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(filter);
    filter.connect(env);
    env.connect(musicBus);
    src.start(t);
}

function scheduleStep(step: number, t: number): void {
    const chord = Math.floor((step % 32) / 8);
    const root = BASS_ROOTS[chord];
    // Pumping bass: root octave on the beat, up an octave off the beat.
    scheduleMusicNote('triangle', step % 2 === 0 ? root : root + 12, t, STEP * 0.9, 0.5);
    // Off-beat hat.
    if (step % 2 === 1) scheduleHat(t);
    // Melody.
    const note = MELODY[step % LOOP_STEPS];
    if (note > 0) scheduleMusicNote('square', note, t, STEP * 1.6, 0.16);
}

function startMusic(): void {
    const c = ctx;
    if (!c || musicTimer) return;
    nextStepTime = c.currentTime + 0.1;
    stepIndex = 0;
    // Lookahead scheduler: wake every 100ms, schedule 250ms ahead — smooth
    // even when the tab hiccups.
    musicTimer = setInterval(() => {
        if (!ctx) return;
        while (nextStepTime < ctx.currentTime + 0.25) {
            scheduleStep(stepIndex, nextStepTime);
            stepIndex = (stepIndex + 1) % LOOP_STEPS;
            nextStepTime += STEP;
        }
    }, 100);
}
