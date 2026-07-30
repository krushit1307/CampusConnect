/**
 * AudioEngine — a singleton Web Audio API synthesizer for procedural UI
 * feedback sounds (click, success, error), built entirely from oscillators
 * and gain envelopes. No .mp3/.wav assets: zero network requests, instant
 * "load" time, tiny bundle footprint.
 *
 * Browser autoplay policies block audio until a user gesture has occurred
 * on the page. This engine defers creating/resuming its AudioContext until
 * the first sound is actually requested, and additionally listens for the
 * page's very first pointer/keyboard interaction to opportunistically
 * resume the context early, so that a sound triggered indirectly (e.g. a
 * toast fired from an async network response) still plays correctly as
 * long as the user has interacted with the page at all this session.
 *
 * All playback failures (suspended context, unsupported browser, etc.)
 * are swallowed silently — this is decorative feedback, never something
 * that should throw or block the feature it's attached to.
 */

type EnvelopeStage = {
  frequency: number;
  type?: OscillatorType;
};

export const SOUND_ENABLED_KEY = "sound_enabled";

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private unlockAttached = false;

  isEnabled(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SOUND_ENABLED_KEY) === "true";
  }

  setEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  /** Lazily create the AudioContext on first use (never at module load). */
  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!this.ctx) {
      this.ctx = new Ctor();
      this.attachUnlockListener();
    }
    return this.ctx;
  }

  /**
   * Opportunistically resume the context on the page's first gesture, so
   * sounds triggered slightly later by async code (e.g. a success toast
   * after a form submit) aren't silently dropped by autoplay policy.
   */
  private attachUnlockListener(): void {
    if (this.unlockAttached || typeof window === "undefined") return;
    this.unlockAttached = true;

    const unlock = () => {
      void this.ctx?.resume().catch(() => {
        /* ignore — will simply retry resume on the next play() call */
      });
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  /** Play a short ADSR-enveloped tone (or sequence of tones). */
  private playEnvelope(
    stages: EnvelopeStage[],
    {
      attack = 0.005,
      decay = 0.08,
      sustain = 0.0001,
      release = 0.05,
      peakGain = 0.15,
      stageDuration = 0.09,
    }: {
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
      peakGain?: number;
      stageDuration?: number;
    } = {},
  ): void {
    if (!this.isEnabled()) return;

    const ctx = this.getContext();
    if (!ctx) return;

    // Best-effort resume; if the browser still refuses (no gesture yet in
    // this session), the sound simply won't play — no error surfaced.
    void ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    let stageStart = now;

    for (const stage of stages) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = stage.type ?? "sine";
      osc.frequency.setValueAtTime(stage.frequency, stageStart);

      const attackEnd = stageStart + attack;
      const decayEnd = attackEnd + decay;
      const releaseEnd = decayEnd + release;

      gain.gain.setValueAtTime(0.0001, stageStart);
      gain.gain.exponentialRampToValueAtTime(peakGain, attackEnd);
      gain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), decayEnd);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(stageStart);
      osc.stop(releaseEnd + 0.02);

      stageStart += stageDuration;
    }
  }

  /** Light click/tap tick — short, high, subtle. */
  playClick(): void {
    try {
      this.playEnvelope([{ frequency: 880, type: "sine" }], {
        attack: 0.002,
        decay: 0.05,
        release: 0.03,
        peakGain: 0.08,
      });
    } catch {
      /* decorative only — never let a sound failure surface to the UI */
    }
  }

  /** Soft low thump for toggles and state changes. */
  playToggle(): void {
    try {
      this.playEnvelope([{ frequency: 180, type: "triangle" }], {
        attack: 0.003,
        decay: 0.07,
        release: 0.05,
        peakGain: 0.1,
      });
    } catch {
      /* decorative only */
    }
  }

  /** Tiny upward pop for likes and positive reactions. */
  playLike(): void {
    try {
      this.playEnvelope(
        [
          { frequency: 760, type: "sine" },
          { frequency: 1180, type: "triangle" },
        ],
        { attack: 0.002, decay: 0.04, release: 0.04, peakGain: 0.09, stageDuration: 0.045 },
      );
    } catch {
      /* decorative only */
    }
  }

  /** Bright ascending two-note chime for success. */
  playSuccess(): void {
    try {
      this.playEnvelope(
        [
          { frequency: 660, type: "triangle" },
          { frequency: 990, type: "triangle" },
        ],
        { attack: 0.004, decay: 0.08, release: 0.09, peakGain: 0.14, stageDuration: 0.1 },
      );
    } catch {
      /* decorative only */
    }
  }

  /** Low descending two-note tone for errors — distinct, not alarming. */
  playError(): void {
    try {
      this.playEnvelope(
        [
          { frequency: 330, type: "sawtooth" },
          { frequency: 220, type: "sawtooth" },
        ],
        { attack: 0.004, decay: 0.09, release: 0.1, peakGain: 0.1, stageDuration: 0.11 },
      );
    } catch {
      /* decorative only */
    }
  }
}

/** Single shared instance for the whole app. */
export const AudioEngine = new AudioEngineImpl();
