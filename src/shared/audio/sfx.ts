/**
 * Short sound effects made with the Web Audio API, so the game ships no audio files yet. The audio context is created
 * on the first player gesture, because browsers block sound until then. Every call is a no-op when sound is off, when
 * the context is missing, or when the browser has not started it.
 */

export type SfxName = 'lantern_on' | 'lantern_off' | 'pickup' | 'snap' | 'miss' | 'wrong' | 'chime' | 'coin';

interface Tone {
  readonly frequency: number;
  /** Seconds after the sound starts. */
  readonly start: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

const SOUNDS: Readonly<Record<SfxName, readonly Tone[]>> = {
  lantern_on: [
    { frequency: 620, start: 0, duration: 0.12, type: 'sine', gain: 0.12 },
    { frequency: 930, start: 0.08, duration: 0.18, type: 'sine', gain: 0.1 },
  ],
  lantern_off: [
    { frequency: 930, start: 0, duration: 0.12, type: 'sine', gain: 0.1 },
    { frequency: 620, start: 0.08, duration: 0.18, type: 'sine', gain: 0.1 },
  ],
  pickup: [{ frequency: 760, start: 0, duration: 0.08, type: 'triangle', gain: 0.12 }],
  // The "tách" of a part snapping into a socket: a short click, then a low body.
  snap: [
    { frequency: 1800, start: 0, duration: 0.04, type: 'square', gain: 0.05 },
    { frequency: 900, start: 0.02, duration: 0.06, type: 'triangle', gain: 0.08 },
  ],
  miss: [{ frequency: 180, start: 0, duration: 0.12, type: 'sawtooth', gain: 0.05 }],
  wrong: [{ frequency: 220, start: 0, duration: 0.18, type: 'square', gain: 0.05 }],
  chime: [
    { frequency: 880, start: 0, duration: 0.3, type: 'sine', gain: 0.1 },
    { frequency: 1320, start: 0.1, duration: 0.3, type: 'sine', gain: 0.08 },
  ],
  coin: [
    { frequency: 988, start: 0, duration: 0.08, type: 'triangle', gain: 0.1 },
    { frequency: 1319, start: 0.07, duration: 0.14, type: 'triangle', gain: 0.1 },
  ],
};

let context: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

/** Creates the audio context after a player gesture, and resumes it if the browser suspended it. Safe to call often. */
export function unlockAudio(): void {
  try {
    if (!context) {
      context = new AudioContext();
    }
    if (context.state === 'suspended') {
      void context.resume();
    }
  } catch {
    // No Web Audio here (old browser, or blocked). The game plays on without sound.
    context = null;
  }
}

export function playSfx(name: SfxName): void {
  if (!enabled || !context || context.state !== 'running') {
    return;
  }
  const now = context.currentTime;
  for (const tone of SOUNDS[name]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.value = tone.frequency;
    const begin = now + tone.start;
    gain.gain.setValueAtTime(0, begin);
    gain.gain.linearRampToValueAtTime(tone.gain, begin + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(begin);
    oscillator.stop(begin + tone.duration + 0.02);
  }
}
