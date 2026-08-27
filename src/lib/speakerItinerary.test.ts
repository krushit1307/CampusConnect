import { describe, it, expect } from "vitest";
import {
  BUFFER_THRESHOLDS,
  MINIMUM_CONNECTION_MINUTES,
  POST_ARRIVAL_PROCESSING_MINUTES,
  bandForBuffer,
  bandLabel,
  explainArrival,
  formatBuffer,
  formatDuration,
  modeLabel,
  projectArrival,
  projectLegs,
  sortByRisk,
  sortLegs,
  validateItinerary,
  type ItineraryLeg,
  type SpeakerItinerary,
  type TravelMode,
} from "./speakerItinerary";

function leg(
  sequence: number,
  mode: TravelMode,
  origin: string,
  destination: string,
  departure: string,
  arrival: string,
  delayMinutes = 0,
): ItineraryLeg {
  return {
    id: `leg-${sequence}`,
    sequence,
    mode,
    carrier: "Test Air",
    reference: `TA${sequence}00`,
    origin,
    destination,
    scheduledDeparture: departure,
    scheduledArrival: arrival,
    delayMinutes,
  };
}

function itinerary(
  legs: ItineraryLeg[],
  overrides: Partial<SpeakerItinerary> = {},
): SpeakerItinerary {
  return {
    id: "it-1",
    speakerName: "Dr Anita Rao",
    direction: "inbound",
    callTime: "2026-06-10T10:00:00.000Z",
    sessionTitle: "Opening keynote",
    hostName: "Student Union",
    groundTransferMinutes: 70,
    legs,
    ...overrides,
  };
}

describe("sortLegs", () => {
  it("orders legs by sequence regardless of input order", () => {
    const legs = [
      leg(3, "car", "C", "D", "2026-06-10T09:00:00Z", "2026-06-10T10:00:00Z"),
      leg(1, "rail", "A", "B", "2026-06-10T05:00:00Z", "2026-06-10T06:00:00Z"),
      leg(2, "bus", "B", "C", "2026-06-10T07:00:00Z", "2026-06-10T08:00:00Z"),
    ];
    expect(sortLegs(legs).map((l) => l.sequence)).toEqual([1, 2, 3]);
  });
});

describe("validateItinerary", () => {
  it("accepts a well-formed single-leg journey", () => {
    const it = itinerary([
      leg(1, "rail", "Central", "Campus Town", "2026-06-10T06:00:00Z", "2026-06-10T07:30:00Z"),
    ]);
    expect(validateItinerary(it)).toEqual([]);
  });

  it("reports an itinerary with no legs at all", () => {
    const problems = validateItinerary(itinerary([]));
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("no_legs");
  });

  it("catches a leg that arrives before it departs", () => {
    const problems = validateItinerary(
      itinerary([leg(1, "rail", "A", "B", "2026-06-10T08:00:00Z", "2026-06-10T06:00:00Z")]),
    );
    expect(problems.some((p) => p.kind === "time_reversal")).toBe(true);
  });

  it("catches a geographic break between legs", () => {
    const problems = validateItinerary(
      itinerary([
        leg(1, "flight_domestic", "DEL", "BOM", "2026-06-10T04:00:00Z", "2026-06-10T06:00:00Z"),
        leg(
          2,
          "rail",
          "PNQ", // does not match BOM
          "Campus",
          "2026-06-10T07:30:00Z",
          "2026-06-10T08:30:00Z",
        ),
      ]),
    );
    const mismatch = problems.find((p) => p.kind === "location_mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch!.legIds).toEqual(["leg-1", "leg-2"]);
  });

  it("compares locations case- and whitespace-insensitively", () => {
    const problems = validateItinerary(
      itinerary([
        leg(1, "rail", "A", " Central Station ", "2026-06-10T04:00:00Z", "2026-06-10T05:00:00Z"),
        leg(2, "bus", "central station", "Campus", "2026-06-10T05:30:00Z", "2026-06-10T06:00:00Z"),
      ]),
    );
    expect(problems.some((p) => p.kind === "location_mismatch")).toBe(false);
  });

  it("flags a layover below the international minimum connection time", () => {
    // 40-minute layover after an international arrival: needs 90.
    const problems = validateItinerary(
      itinerary([
        leg(
          1,
          "flight_international",
          "LHR",
          "DEL",
          "2026-06-09T20:00:00Z",
          "2026-06-10T04:00:00Z",
        ),
        leg(2, "flight_domestic", "DEL", "BLR", "2026-06-10T04:40:00Z", "2026-06-10T07:00:00Z"),
      ]),
    );
    const short = problems.find((p) => p.kind === "short_connection");
    expect(short).toBeDefined();
    expect(short!.shortfallMinutes).toBe(50);
    expect(short!.message).toMatch(/at least 90/);
  });

  it("accepts the same layover when the arriving mode is rail", () => {
    // 40 minutes is comfortable off a train (needs 20).
    const problems = validateItinerary(
      itinerary([
        leg(1, "rail", "A", "B", "2026-06-10T03:00:00Z", "2026-06-10T04:00:00Z"),
        leg(2, "bus", "B", "Campus", "2026-06-10T04:40:00Z", "2026-06-10T05:30:00Z"),
      ]),
    );
    expect(problems.some((p) => p.kind === "short_connection")).toBe(false);
  });

  it("catches a leg departing before the previous one lands", () => {
    const problems = validateItinerary(
      itinerary([
        leg(1, "rail", "A", "B", "2026-06-10T03:00:00Z", "2026-06-10T06:00:00Z"),
        leg(2, "bus", "B", "Campus", "2026-06-10T05:00:00Z", "2026-06-10T05:30:00Z"),
      ]),
    );
    expect(problems.some((p) => p.kind === "time_reversal")).toBe(true);
  });

  it("notices a gap in the leg numbering", () => {
    const problems = validateItinerary(
      itinerary([
        leg(1, "rail", "A", "B", "2026-06-10T03:00:00Z", "2026-06-10T04:00:00Z"),
        leg(3, "bus", "B", "Campus", "2026-06-10T05:00:00Z", "2026-06-10T05:30:00Z"),
      ]),
    );
    expect(problems.some((p) => p.kind === "sequence_gap")).toBe(true);
  });

  it("reports an unreadable timestamp rather than producing NaN", () => {
    const problems = validateItinerary(
      itinerary([leg(1, "rail", "A", "B", "not-a-date", "2026-06-10T04:00:00Z")]),
    );
    expect(problems.some((p) => p.kind === "invalid_timestamp")).toBe(true);
  });

  it("reports every problem rather than stopping at the first", () => {
    const problems = validateItinerary(
      itinerary([
        leg(
          1,
          "flight_international",
          "LHR",
          "DEL",
          "2026-06-09T20:00:00Z",
          "2026-06-10T04:00:00Z",
        ),
        leg(
          2,
          "flight_domestic",
          "BOM", // mismatch
          "BLR",
          "2026-06-10T04:30:00Z", // and a short connection
          "2026-06-10T07:00:00Z",
        ),
      ]),
    );
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});

describe("projectLegs", () => {
  it("leaves an on-time journey untouched", () => {
    const legs = projectLegs(
      itinerary([leg(1, "rail", "A", "Campus", "2026-06-10T06:00:00Z", "2026-06-10T07:30:00Z")]),
    );
    expect(legs[0].projectedArrival).toBe("2026-06-10T07:30:00.000Z");
    expect(legs[0].totalDelayMinutes).toBe(0);
  });

  it("pushes the arrival out by a leg's own delay", () => {
    const legs = projectLegs(
      itinerary([
        leg(1, "rail", "A", "Campus", "2026-06-10T06:00:00Z", "2026-06-10T07:30:00Z", 45),
      ]),
    );
    expect(legs[0].projectedArrival).toBe("2026-06-10T08:15:00.000Z");
    expect(legs[0].totalDelayMinutes).toBe(45);
  });

  it("lets a generous layover absorb an upstream delay", () => {
    // 4-hour layover; a 60 minute delay on leg 1 changes nothing downstream.
    const legs = projectLegs(
      itinerary([
        leg(
          1,
          "flight_international",
          "LHR",
          "DEL",
          "2026-06-09T20:00:00Z",
          "2026-06-10T02:00:00Z",
          60,
        ),
        leg(2, "flight_domestic", "DEL", "BLR", "2026-06-10T06:00:00Z", "2026-06-10T08:30:00Z"),
      ]),
    );
    expect(legs[1].inheritedDelayMinutes).toBe(0);
    expect(legs[1].connectionMissed).toBe(false);
    expect(legs[1].projectedArrival).toBe("2026-06-10T08:30:00.000Z");
  });

  it("marks the connection missed when the delay eats the layover", () => {
    // 2-hour layover, 120-minute delay on the international leg.
    const legs = projectLegs(
      itinerary([
        leg(
          1,
          "flight_international",
          "LHR",
          "DEL",
          "2026-06-09T20:00:00Z",
          "2026-06-10T02:00:00Z",
          120,
        ),
        leg(2, "flight_domestic", "DEL", "BLR", "2026-06-10T04:00:00Z", "2026-06-10T06:30:00Z"),
      ]),
    );
    expect(legs[1].connectionMissed).toBe(true);
    expect(legs[1].inheritedDelayMinutes).toBeGreaterThan(0);
  });

  it("cascades a delay through a three-leg chain", () => {
    const legs = projectLegs(
      itinerary([
        leg(
          1,
          "flight_international",
          "LHR",
          "DEL",
          "2026-06-09T18:00:00Z",
          "2026-06-10T00:00:00Z",
          150,
        ),
        leg(2, "flight_domestic", "DEL", "BLR", "2026-06-10T02:00:00Z", "2026-06-10T04:30:00Z"),
        leg(3, "car", "BLR", "Campus", "2026-06-10T05:30:00Z", "2026-06-10T06:30:00Z"),
      ]),
    );
    expect(legs[1].connectionMissed).toBe(true);
    // The final arrival must be later than scheduled.
    expect(new Date(legs[2].projectedArrival).getTime()).toBeGreaterThan(
      new Date("2026-06-10T06:30:00Z").getTime(),
    );
  });

  it("passes unreadable legs through without producing NaN dates", () => {
    const legs = projectLegs(itinerary([leg(1, "rail", "A", "B", "nope", "also-nope")]));
    expect(legs[0].projectedArrival).toBe("also-nope");
  });

  it("handles a leg running early as a negative delay", () => {
    const legs = projectLegs(
      itinerary([
        leg(1, "rail", "A", "Campus", "2026-06-10T06:00:00Z", "2026-06-10T07:30:00Z", -15),
      ]),
    );
    expect(legs[0].projectedArrival).toBe("2026-06-10T07:15:00.000Z");
  });
});

describe("projectArrival", () => {
  it("adds immigration, baggage and ground transfer to a landing time", () => {
    // Lands 04:00, +60 processing, +70 transfer → on campus 06:10.
    const projection = projectArrival(
      itinerary(
        [
          leg(
            1,
            "flight_international",
            "LHR",
            "BLR",
            "2026-06-09T20:00:00Z",
            "2026-06-10T04:00:00Z",
          ),
        ],
        { callTime: "2026-06-10T10:00:00Z" },
      ),
    );

    expect(projection.processingMinutes).toBe(60);
    expect(projection.projectedCampusArrival).toBe("2026-06-10T06:10:00.000Z");
    expect(projection.bufferMinutes).toBe(230);
    expect(projection.band).toBe("comfortable");
  });

  it("reproduces the issue's scenario: lands 09:15, due on stage at 10:00", () => {
    const projection = projectArrival(
      itinerary(
        [
          leg(
            1,
            "flight_international",
            "SIN",
            "BLR",
            "2026-06-10T03:00:00Z",
            "2026-06-10T09:15:00Z",
          ),
        ],
        { callTime: "2026-06-10T10:00:00Z", groundTransferMinutes: 70 },
      ),
    );

    // 09:15 + 60 immigration/baggage + 70 transfer = 11:25, due at 10:00.
    expect(projection.projectedCampusArrival).toBe("2026-06-10T11:25:00.000Z");
    expect(projection.bufferMinutes).toBe(-85);
    expect(projection.band).toBe("will_miss");
    expect(projection.flagReason).toMatch(/after the call time/);
  });

  it("does not charge immigration time to a rail arrival", () => {
    const projection = projectArrival(
      itinerary(
        [leg(1, "rail", "Central", "Campus Town", "2026-06-10T06:00:00Z", "2026-06-10T08:00:00Z")],
        { callTime: "2026-06-10T10:00:00Z", groundTransferMinutes: 20 },
      ),
    );
    expect(projection.processingMinutes).toBe(POST_ARRIVAL_PROCESSING_MINUTES.rail);
    expect(projection.projectedCampusArrival).toBe("2026-06-10T08:30:00.000Z");
  });

  it("re-bands the journey when a delay is entered on the first leg", () => {
    const base = itinerary(
      [leg(1, "flight_domestic", "DEL", "BLR", "2026-06-10T04:00:00Z", "2026-06-10T06:30:00Z")],
      { callTime: "2026-06-10T10:00:00Z", groundTransferMinutes: 70 },
    );

    const onTime = projectArrival(base);
    expect(onTime.band).toBe("comfortable");

    const delayed = projectArrival({
      ...base,
      legs: [{ ...base.legs[0], delayMinutes: 150 }],
    });
    expect(delayed.bufferMinutes!).toBeLessThan(onTime.bufferMinutes!);
    expect(delayed.band).toBe("will_miss");
  });

  it("leads with the missed connection when one exists", () => {
    const projection = projectArrival(
      itinerary(
        [
          leg(
            1,
            "flight_international",
            "LHR",
            "DEL",
            "2026-06-09T18:00:00Z",
            "2026-06-10T00:00:00Z",
            180,
          ),
          leg(2, "flight_domestic", "DEL", "BLR", "2026-06-10T02:00:00Z", "2026-06-10T04:30:00Z"),
        ],
        { callTime: "2026-06-10T14:00:00Z" },
      ),
    );
    expect(projection.flagReason).toMatch(/no longer achievable/);
  });

  it("returns a projection, not a throw, for an empty itinerary", () => {
    const projection = projectArrival(itinerary([]));
    expect(projection.projectedCampusArrival).toBeNull();
    expect(projection.bufferMinutes).toBeNull();
    expect(projection.flagReason).toMatch(/No travel legs/);
  });

  it("handles an unreadable call time without producing NaN", () => {
    const projection = projectArrival(
      itinerary([leg(1, "rail", "A", "B", "2026-06-10T06:00:00Z", "2026-06-10T07:00:00Z")], {
        callTime: "whenever",
      }),
    );
    expect(projection.bufferMinutes).toBeNull();
    expect(projection.flagReason).toMatch(/unreadable time/);
  });

  it("says nothing is wrong when nothing is wrong", () => {
    const projection = projectArrival(
      itinerary(
        [leg(1, "rail", "Central", "Campus", "2026-06-10T04:00:00Z", "2026-06-10T06:00:00Z")],
        { callTime: "2026-06-10T10:00:00Z", groundTransferMinutes: 20 },
      ),
    );
    expect(projection.band).toBe("comfortable");
    expect(projection.flagReason).toBeNull();
  });
});

describe("bandForBuffer", () => {
  it("bands a journey by how much margin it has", () => {
    expect(bandForBuffer(200)).toBe("comfortable");
    expect(bandForBuffer(BUFFER_THRESHOLDS.comfortable)).toBe("comfortable");
    expect(bandForBuffer(60)).toBe("tight");
    expect(bandForBuffer(BUFFER_THRESHOLDS.tight)).toBe("tight");
    expect(bandForBuffer(10)).toBe("critical");
    expect(bandForBuffer(0)).toBe("critical");
    expect(bandForBuffer(-1)).toBe("will_miss");
  });
});

describe("sortByRisk", () => {
  it("puts the speaker most likely to miss their session first", () => {
    const make = (name: string, callTime: string, arrival: string) =>
      projectArrival(
        itinerary([leg(1, "rail", "A", "Campus", "2026-06-10T04:00:00Z", arrival)], {
          id: name,
          speakerName: name,
          callTime,
          groundTransferMinutes: 0,
        }),
      );

    const comfortable = make("Comfortable", "2026-06-10T20:00:00Z", "2026-06-10T06:00:00Z");
    const willMiss = make("WillMiss", "2026-06-10T06:00:00Z", "2026-06-10T09:00:00Z");
    const tight = make("Tight", "2026-06-10T07:00:00Z", "2026-06-10T06:00:00Z");

    const sorted = sortByRisk([comfortable, tight, willMiss]);
    expect(sorted[0].speakerName).toBe("WillMiss");
    expect(sorted[sorted.length - 1].speakerName).toBe("Comfortable");
  });
});

describe("presentation helpers", () => {
  it("labels every travel mode", () => {
    const modes: TravelMode[] = [
      "flight_international",
      "flight_domestic",
      "rail",
      "bus",
      "car",
      "ground_transfer",
    ];
    for (const mode of modes) {
      expect(modeLabel(mode).length).toBeGreaterThan(0);
      expect(MINIMUM_CONNECTION_MINUTES[mode]).toBeGreaterThanOrEqual(0);
    }
  });

  it("labels every risk band", () => {
    expect(bandLabel("comfortable")).toBe("Comfortable");
    expect(bandLabel("will_miss")).toBe("Will miss session");
  });

  it("formats durations readably", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(95)).toBe("1h 35m");
  });

  it("describes a buffer as spare time or lateness", () => {
    expect(formatBuffer(90)).toBe("1h 30m spare");
    expect(formatBuffer(-45)).toBe("45 min late");
    expect(formatBuffer(null)).toBe("Unknown");
  });

  it("explains how the campus arrival was derived", () => {
    const projection = projectArrival(
      itinerary(
        [
          leg(
            1,
            "flight_international",
            "LHR",
            "BLR",
            "2026-06-09T20:00:00Z",
            "2026-06-10T04:00:00Z",
          ),
        ],
        { callTime: "2026-06-10T10:00:00Z", groundTransferMinutes: 70 },
      ),
    );
    const steps = explainArrival(projection);
    expect(steps.some((s) => /immigration and baggage/.test(s))).toBe(true);
    expect(steps.some((s) => /ground transfer/.test(s))).toBe(true);
    expect(steps.some((s) => /on campus/.test(s))).toBe(true);
  });

  it("returns no explanation steps for an itinerary with no legs", () => {
    expect(explainArrival(projectArrival(itinerary([])))).toEqual([]);
  });
});
