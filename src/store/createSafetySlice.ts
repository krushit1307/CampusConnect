import { createSignal } from "../lib/signals";

export type ThreatLevel = "normal" | "elevated" | "critical";
export type CalibrationStatus = "idle" | "in_progress" | "complete" | "failed";

export interface SafetyLockState {
  isLocked: boolean;
  reason?: string;
  duressFlag: boolean;
}

export const [safetyLockSignal, setSafetyLockSignal] = createSignal<SafetyLockState>({
  isLocked: false,
  duressFlag: false,
});
export const [threatLevelSignal, setThreatLevelSignal] = createSignal<ThreatLevel>("normal");
export const [calibrationStatusSignal, setCalibrationStatusSignal] =
  createSignal<CalibrationStatus>("idle");

export function resetSafetySlice(): void {
  setSafetyLockSignal({ isLocked: false, duressFlag: false });
  setThreatLevelSignal("normal");
  setCalibrationStatusSignal("idle");
}

// ─── Slice factory for composition ───────────────────────────────────

export interface SafetySlice {
  safetyLock: SafetyLockState;
  threatLevel: ThreatLevel;
  calibrationStatus: CalibrationStatus;
  setSafetyLock: (state: SafetyLockState) => void;
  setThreatLevel: (level: ThreatLevel) => void;
  setCalibrationStatus: (status: CalibrationStatus) => void;
  resetSafetySlice: () => void;
}

type SetState<T> = (state: Partial<T> | ((prev: T) => Partial<T>)) => void;

export function createSafetySlice(set: SetState<SafetySlice>): SafetySlice {
  return {
    safetyLock: { isLocked: false, duressFlag: false },
    threatLevel: "normal",
    calibrationStatus: "idle",
    setSafetyLock: (state: SafetyLockState) => {
      setSafetyLockSignal(state);
      set({ safetyLock: state });
    },
    setThreatLevel: (level: ThreatLevel) => {
      setThreatLevelSignal(level);
      set({ threatLevel: level });
    },
    setCalibrationStatus: (status: CalibrationStatus) => {
      setCalibrationStatusSignal(status);
      set({ calibrationStatus: status });
    },
    resetSafetySlice: () => {
      setSafetyLockSignal({ isLocked: false, duressFlag: false });
      setThreatLevelSignal("normal");
      setCalibrationStatusSignal("idle");
      set({
        safetyLock: { isLocked: false, duressFlag: false },
        threatLevel: "normal",
        calibrationStatus: "idle",
      });
    },
  };
}
