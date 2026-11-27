// Phase 2C-3c: looping playback counts as ONE activity session. It completes
// when the user stops after at least one full play, and is abandoned if
// stopped before the first play-through ends. No imports, so it is unit-tested directly.

export const defaultLoop = (type: string | null | undefined): boolean => type === 'sleep';

// Largest gap between two timeupdate events that still counts as continuous
// playback (browsers fire every ~250 ms); bigger jumps are seeks.
const MAX_STEP = 2.5;
// Allowance for the last timeupdate arriving slightly before the end.
const END_TOLERANCE = 1;

export type PlayTracker = {
  /** Feed every `timeupdate`. */
  update(currentTime: number, duration: number, seeking?: boolean): void;
  /** Seconds actually played (seeks excluded). */
  readonly played: number;
  /** True once at least one full play-through has been heard. */
  fullPlay(duration: number): boolean;
  /** Outcome when the user stops (or leaves) now. */
  stopOutcome(duration: number): 'completed' | 'abandoned';
};

export function createPlayTracker(): PlayTracker {
  let last: number | null = null;
  let played = 0;
  return {
    update(currentTime, duration, seeking = false) {
      if (!Number.isFinite(currentTime) || currentTime < 0) return;
      if (last !== null && !seeking) {
        const delta = currentTime - last;
        if (delta > 0 && delta <= MAX_STEP) played += delta;
        // Loop wrap: from near the end back to near the start.
        else if (delta < 0 && Number.isFinite(duration) && last >= duration - MAX_STEP && currentTime <= MAX_STEP) played += (duration - last) + currentTime;
      }
      last = currentTime;
    },
    get played() { return played; },
    fullPlay(duration) { return Number.isFinite(duration) && duration > 0 && played >= duration - END_TOLERANCE; },
    stopOutcome(duration) { return this.fullPlay(duration) ? 'completed' : 'abandoned'; }
  };
}
