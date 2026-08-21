import { describe, it, expect } from "vitest";
import {
  buildTimelineStops,
  nearestStopForPosition,
  versionActiveAt,
  isBeforeFirstVersion,
  versionLabel,
  type ArchivedConstitution,
} from "./constitutionTimeline";

function makeVersion(overrides: Partial<ArchivedConstitution>): ArchivedConstitution {
  return {
    id: `id-${overrides.version_number ?? Math.random().toString(36).slice(2)}`,
    version_number: 1,
    raw_text: "Sample constitution text.",
    file_url: null,
    published_by: null,
    change_summary: null,
    effective_from: "2022-01-01T00:00:00.000Z",
    effective_to: null,
    created_at: "2022-01-01T00:00:00.000Z",
    is_current: true,
    ...overrides,
  };
}

describe("buildTimelineStops", () => {
  it("returns an empty array for an empty input", () => {
    expect(buildTimelineStops([])).toEqual([]);
  });

  it("places a single version at position 1", () => {
    const v = makeVersion({ version_number: 1 });
    const stops = buildTimelineStops([v]);
    expect(stops).toHaveLength(1);
    expect(stops[0].position).toBe(1);
    expect(stops[0].yearLabel).toBe("2022");
    expect(stops[0].version).toBe(v);
  });

  it("distributes multiple versions proportionally by timestamp", () => {
    const v1 = makeVersion({
      version_number: 1,
      effective_from: "2018-01-01T00:00:00.000Z",
      effective_to: "2020-01-01T00:00:00.000Z",
      is_current: false,
    });
    const v2 = makeVersion({
      version_number: 2,
      effective_from: "2022-01-01T00:00:00.000Z",
      effective_to: "2026-01-01T00:00:00.000Z",
      is_current: false,
    });
    const v3 = makeVersion({
      version_number: 3,
      effective_from: "2026-01-01T00:00:00.000Z",
      is_current: true,
    });
    const stops = buildTimelineStops([v3, v1, v2]);

    expect(stops).toHaveLength(3);
    expect(stops[0].position).toBe(0);
    expect(stops[2].position).toBe(1);
    expect(stops[0].version.version_number).toBe(1);
    expect(stops[1].version.version_number).toBe(2);
    expect(stops[2].version.version_number).toBe(3);

    expect(stops[0].yearLabel).toBe("2018");
    expect(stops[1].yearLabel).toBe("2022");
    expect(stops[2].yearLabel).toBe("2026");
  });

  it("handles versions with identical effective_from without dividing by zero", () => {
    const v1 = makeVersion({ version_number: 1, effective_from: "2022-01-01T00:00:00.000Z" });
    const v2 = makeVersion({ version_number: 2, effective_from: "2022-01-01T00:00:00.000Z" });
    const stops = buildTimelineStops([v1, v2]);
    expect(stops).toHaveLength(2);
    expect(Number.isFinite(stops[0].position)).toBe(true);
    expect(Number.isFinite(stops[1].position)).toBe(true);
  });
});

describe("nearestStopForPosition", () => {
  it("returns null when there are no stops", () => {
    expect(nearestStopForPosition([], 0.5)).toBeNull();
  });

  it("returns the only stop when there is one", () => {
    const v = makeVersion({ version_number: 1 });
    const stops = buildTimelineStops([v]);
    expect(nearestStopForPosition(stops, 0.3)).toBe(stops[0]);
  });

  it("snaps to the closest of three stops", () => {
    const stops = buildTimelineStops([
      makeVersion({ version_number: 1, effective_from: "2018-01-01T00:00:00.000Z" }),
      makeVersion({ version_number: 2, effective_from: "2022-01-01T00:00:00.000Z" }),
      makeVersion({ version_number: 3, effective_from: "2026-01-01T00:00:00.000Z" }),
    ]);
    expect(nearestStopForPosition(stops, 0.1)?.version.version_number).toBe(1);
    expect(nearestStopForPosition(stops, 0.45)?.version.version_number).toBe(2);
    expect(nearestStopForPosition(stops, 0.9)?.version.version_number).toBe(3);
  });
});

describe("versionActiveAt", () => {
  it("returns null when no versions exist", () => {
    expect(versionActiveAt([], "2022-01-01T00:00:00.000Z")).toBeNull();
  });

  it("returns the version whose effective interval contains the timestamp", () => {
    const v1 = makeVersion({
      version_number: 1,
      effective_from: "2018-01-01T00:00:00.000Z",
      effective_to: "2022-01-01T00:00:00.000Z",
      is_current: false,
    });
    const v2 = makeVersion({
      version_number: 2,
      effective_from: "2022-01-01T00:00:00.000Z",
      effective_to: null,
      is_current: true,
    });
    expect(versionActiveAt([v1, v2], "2020-06-01T00:00:00.000Z")?.version_number).toBe(1);
    expect(versionActiveAt([v1, v2], "2024-06-01T00:00:00.000Z")?.version_number).toBe(2);
  });

  it("returns null when the timestamp is before the first version", () => {
    const v1 = makeVersion({
      version_number: 1,
      effective_from: "2022-01-01T00:00:00.000Z",
      effective_to: null,
      is_current: true,
    });
    expect(versionActiveAt([v1], "2020-01-01T00:00:00.000Z")).toBeNull();
  });

  it("returns null for an invalid timestamp string", () => {
    const v1 = makeVersion({ version_number: 1 });
    expect(versionActiveAt([v1], "not-a-date")).toBeNull();
  });
});

describe("isBeforeFirstVersion", () => {
  it("returns true when versions list is empty", () => {
    expect(isBeforeFirstVersion([], "2022-01-01T00:00:00.000Z")).toBe(true);
  });

  it("returns true when timestamp is before the oldest version", () => {
    const v = makeVersion({
      version_number: 1,
      effective_from: "2022-06-01T00:00:00.000Z",
    });
    expect(isBeforeFirstVersion([v], "2022-01-01T00:00:00.000Z")).toBe(true);
  });

  it("returns false when timestamp is after the oldest version", () => {
    const v = makeVersion({
      version_number: 1,
      effective_from: "2022-01-01T00:00:00.000Z",
    });
    expect(isBeforeFirstVersion([v], "2023-01-01T00:00:00.000Z")).toBe(false);
  });
});

describe("versionLabel", () => {
  it("includes version number, short date, and current marker", () => {
    const v = makeVersion({
      version_number: 3,
      effective_from: "2022-06-15T00:00:00.000Z",
      is_current: true,
    });
    expect(versionLabel(v)).toBe("Version 3 · Jun 2022 (current)");
  });

  it("omits the current marker when is_current is false", () => {
    const v = makeVersion({
      version_number: 2,
      effective_from: "2020-03-01T00:00:00.000Z",
      is_current: false,
    });
    expect(versionLabel(v)).toBe("Version 2 · Mar 2020");
  });

  it("renders a placeholder for an invalid date", () => {
    const v = makeVersion({
      version_number: 1,
      effective_from: "not-a-date",
      is_current: false,
    });
    expect(versionLabel(v)).toBe("Version 1 · —");
  });
});
