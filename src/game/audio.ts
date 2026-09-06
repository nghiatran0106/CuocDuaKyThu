/** Tiny, asset-free soundtrack and arcade sound effects. */
export class RaceAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private enabled: boolean;
  private stopped = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  start() {
    if (this.stopped) return;
    try {
      if (!this.context) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.22 : 0;
        this.master.connect(this.context.destination);
        this.engine = this.context.createOscillator();
        this.engine.type = "triangle";
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional on browsers without an audio device. */
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.start();
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        enabled ? 0.22 : 0,
        this.context.currentTime,
        0.04,
      );
  }

  speed(ratio: number, drifting: boolean) {
    if (!this.context || !this.engine || !this.engineGain) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(
      48 + ratio * 76 + (drifting ? 14 : 0),
      now,
      0.15,
    );
    this.engineGain.gain.setTargetAtTime(
      Math.min(0.09, ratio * 0.075),
      now,
      0.1,
    );
  }

  quiet() {
    if (this.engineGain && this.context)
      this.engineGain.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
  }

  play(
    kind:
      | "countdown"
      | "go"
      | "coin"
      | "pickup"
      | "boost"
      | "hit"
      | "finish"
      | "drift",
  ) {
    if (!this.enabled) return;
    this.start();
    if (!this.context || !this.master) return;
    const melodies: Record<typeof kind, number[]> = {
      countdown: [440],
      go: [660, 880],
      coin: [988, 1319],
      pickup: [523, 659, 784, 1047],
      boost: [196, 392, 784],
      hit: [140, 95],
      finish: [523, 659, 784, 1047, 784, 1047],
      drift: [740, 988, 1319],
    };
    const now = this.context.currentTime;
    melodies[kind].forEach((frequency, i) => {
      if (!this.context || !this.master) return;
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const start = now + i * 0.075;
      oscillator.type = kind === "hit" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.38, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    });
  }

  destroy() {
    this.stopped = true;
    try {
      this.engine?.stop();
    } catch {
      /* Already stopped. */
    }
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
  }
}
