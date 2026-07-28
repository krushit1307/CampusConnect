import { useCallback, useEffect, useRef } from "react";

type UseIdleTimerOptions = {
  onIdle: () => void;
  onWarning: () => void;
  idleTime?: number;
  warningTime?: number;
  enabled?: boolean;
};

export function useIdleTimer({
  onIdle,
  onWarning,
  idleTime = 30 * 60 * 1000,
  warningTime = 25 * 60 * 1000,
  enabled = true,
}: UseIdleTimerOptions) {
  // sets a warning timeout and an idle timeout, clears + restarts both
  // whenever a mousemove/keydown/wheel/touchstart event fires (debounced)
}