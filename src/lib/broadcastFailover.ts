export type BroadcastConnectionState = "connected" | "disconnected" | "failed" | "checking";
export type BroadcastState = "primary" | "fallback" | "recovering" | "ended";

export function nextBroadcastState(
  currentState: BroadcastState,
  connectionState: BroadcastConnectionState,
  avCheckPassed: boolean,
): BroadcastState {
  if (avCheckPassed && connectionState === "connected") return "primary";
  if (connectionState === "disconnected" || connectionState === "failed") return "fallback";
  return currentState;
}

export function shouldUseFallback(state: BroadcastState, activeSource: "primary" | "fallback") {
  return state === "fallback" || activeSource === "fallback";
}
