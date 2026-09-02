/**
 * useSpatialWayfinding (Issue #5458).
 *
 * React hook that drives the spatial acoustic wayfinding flow:
 *  - reads user position, target position and head orientation from a
 *    `SpatialPositionProvider` (mock by default),
 *  - recomputes the navigation snapshot on an interval,
 *  - feeds the live bearing/distance into the Web Audio beacon,
 *  - exposes start/stop and accessibility status, and cleans up all timers and
 *    audio resources when navigation stops or the hook unmounts.
 *
 * The provider and beacon are injectable for testing; in production they default
 * to the mock provider and the singleton Web Audio beacon. Native UWB ranging can
 * later be supplied through the same provider interface.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { mockSpatialPositionProvider } from "@/lib/accessibility/mockSpatialPositionProvider";
import { SpatialAudioBeacon, spatialAudioBeacon } from "@/lib/accessibility/spatialAudioBeacon";
import { buildNavigationSnapshot } from "@/lib/accessibility/spatialWayfindingCalculations";
import {
  SpatialNavigationSnapshot,
  SpatialPositionProvider,
  SpatialWayfindingStatus,
} from "@/types/spatialWayfinding";

export interface UseSpatialWayfindingOptions {
  /** Position provider to read spatial data from. Defaults to the mock provider. */
  provider?: SpatialPositionProvider;
  /** Audio beacon to drive. Defaults to the singleton Web Audio beacon. */
  beacon?: SpatialAudioBeacon;
  /** How often to poll the provider, in milliseconds. Defaults to 250. */
  pollIntervalMs?: number;
}

export interface UseSpatialWayfindingResult {
  status: SpatialWayfindingStatus;
  snapshot: SpatialNavigationSnapshot | null;
  error: string | null;
  audioAvailable: boolean;
  startNavigation: () => Promise<void>;
  stopNavigation: () => void;
  setVolume: (volume: number) => void;
}

export function useSpatialWayfinding(
  options: UseSpatialWayfindingOptions = {},
): UseSpatialWayfindingResult {
  const providerRef = useRef<SpatialPositionProvider>(
    options.provider ?? mockSpatialPositionProvider,
  );
  const beaconRef = useRef<SpatialAudioBeacon>(options.beacon ?? spatialAudioBeacon);
  const pollIntervalMs = Math.max(50, options.pollIntervalMs ?? 250);

  const [status, setStatus] = useState<SpatialWayfindingStatus>("idle");
  const [snapshot, setSnapshot] = useState<SpatialNavigationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(() =>
    SpatialAudioBeacon.isSupported(),
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Read the current positions/orientation and update state + beacon position.
   * Never throws: provider failures surface as an accessible error message.
   */
  const refresh = useCallback(async () => {
    const provider = providerRef.current;
    let target;
    let user;
    let head;
    try {
      [target, user, head] = await Promise.all([
        provider.getTargetPosition(),
        provider.getUserPosition(),
        provider.getHeadOrientation(),
      ]);
    } catch {
      setError("Unable to read spatial position data from the provider.");
      return;
    }

    const next = buildNavigationSnapshot(target ?? null, user ?? null, head ?? null);
    if (next === null) {
      setSnapshot(null);
      setError("Target or user position is unavailable or invalid.");
      return;
    }

    setError(null);
    setSnapshot(next);

    if (beaconRef.current.isRunning) {
      beaconRef.current.setPosition(
        next.relativeBearingDeg,
        next.distanceM,
        (target?.z ?? 0) - (user?.z ?? 0),
      );
    }
  }, []);

  const startNavigation = useCallback(async () => {
    if (intervalRef.current !== null) return; // already navigating

    setStatus("starting");
    setError(null);

    const beacon = beaconRef.current;
    if (!beacon.isRunning) {
      let started = false;
      try {
        started = await beacon.start();
      } catch {
        started = false;
      }
      setAudioAvailable(started);
    }

    await refresh();
    setStatus("navigating");
    intervalRef.current = setInterval(() => {
      void refresh();
    }, pollIntervalMs);
  }, [refresh, pollIntervalMs]);

  const stopNavigation = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    beaconRef.current.stop();
    setStatus("stopped");
    setSnapshot(null);
    setError(null);
  }, []);

  const setVolume = useCallback((volume: number) => {
    beaconRef.current.setVolume(volume);
  }, []);

  // Release every resource when the hook unmounts.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      beaconRef.current.stop();
    };
  }, []);

  return { status, snapshot, error, audioAvailable, startNavigation, stopNavigation, setVolume };
}
