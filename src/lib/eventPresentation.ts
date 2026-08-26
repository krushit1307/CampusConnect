export const PRESENTATION_CHANNEL_PREFIX = "event-presentation";

export type PresentationEvent =
  | {
      event: "slide_change";
      payload: { index: number };
    }
  | {
      event: "laser_pointer";
      payload: { x: number; y: number; active: boolean };
    }
  | {
      event: "presentation_state";
      payload: { index: number };
    };

export function presentationChannelName(eventId: string) {
  return `${PRESENTATION_CHANNEL_PREFIX}:${eventId}`;
}

export function clampSlideIndex(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}

export function isValidSlideIndex(value: unknown, slideCount: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < slideCount;
}

export function isValidLaserPointerPayload(value: unknown): value is PresentationEvent["payload"] {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.x === "number" &&
    Number.isFinite(payload.x) &&
    payload.x >= 0 &&
    payload.x <= 1 &&
    typeof payload.y === "number" &&
    Number.isFinite(payload.y) &&
    payload.y >= 0 &&
    payload.y <= 1 &&
    typeof payload.active === "boolean"
  );
}
