import { describe, it, expect } from "vitest";
import {
  TIER_REQUIREMENTS,
  analyseCoverage,
  certificationsExpiringWithin,
  complianceVerdict,
  deriveRiskTier,
  effectiveCertificationAt,
  formatMinutes,
  levelLabel,
  meetsLevel,
  segmentDutyByCertification,
  tierLabel,
  verdictSummary,
  type CertificationLevel,
  type ResponderCertification,
  type ResponderDuty,
} from "./responderCoverage";

const EVENT_START = "2026-06-10T14:00:00.000Z";
const EVENT_END = "2026-06-10T20:00:00.000Z";

function duty(id: string, responderId: string, startsAt: string, endsAt: string): ResponderDuty {
  return {
    id,
    responderId,
    responderName: `Responder ${responderId}`,
    startsAt,
    endsAt,
    station: "Main gate",
  };
}

function cert(
  userId: string,
  level: CertificationLevel,
  issuedOn = "2025-01-01T00:00:00.000Z",
  expiresOn = "2027-01-01T00:00:00.000Z",
): ResponderCertification {
  return {
    id: `cert-${userId}-${level}-${expiresOn}`,
    userId,
    level,
    issuingBody: "Red Cross",
    issuedOn,
    expiresOn,
  };
}

const at = (iso: string) => new Date(iso).getTime();

describe("deriveRiskTier", () => {
  it("scales the tier with expected attendance", () => {
    expect(deriveRiskTier(50, "sedentary")).toBe("low");
    expect(deriveRiskTier(200, "sedentary")).toBe("moderate");
    expect(deriveRiskTier(800, "sedentary")).toBe("high");
    expect(deriveRiskTier(3000, "sedentary")).toBe("extreme");
  });

  it("raises the tier for a risky activity at small attendance", () => {
    // 200 people at a contact fixture outranks 200 at a lecture.
    expect(deriveRiskTier(200, "contact_sport")).toBe("high");
    expect(deriveRiskTier(30, "hazardous")).toBe("extreme");
  });

  it("takes the higher signal rather than averaging the two", () => {
    expect(deriveRiskTier(3000, "sedentary")).toBe("extreme");
    expect(deriveRiskTier(20, "hazardous")).toBe("extreme");
  });
});

describe("effectiveCertificationAt", () => {
  const certs = [
    cert("r1", "basic", "2025-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
    cert("r1", "advanced", "2025-06-01T00:00:00Z", "2026-06-10T17:00:00Z"),
    cert("r2", "basic", "2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z"),
  ];

  it("returns the highest level valid at that instant", () => {
    const found = effectiveCertificationAt(certs, "r1", at(EVENT_START));
    expect(found?.level).toBe("advanced");
  });

  it("falls back to a lower level once the higher one expires", () => {
    const found = effectiveCertificationAt(certs, "r1", at("2026-06-10T18:00:00Z"));
    expect(found?.level).toBe("basic");
  });

  it("returns null for a responder whose certification has lapsed", () => {
    expect(effectiveCertificationAt(certs, "r2", at(EVENT_START))).toBeNull();
  });

  it("returns null before a certification was issued", () => {
    expect(effectiveCertificationAt(certs, "r1", at("2024-01-01T00:00:00Z"))).toBeNull();
  });

  it("treats the expiry instant itself as expired", () => {
    expect(effectiveCertificationAt(certs, "r1", at("2026-06-10T17:00:00Z"))?.level).toBe("basic");
  });
});

describe("meetsLevel", () => {
  it("accepts an equal or higher level", () => {
    expect(meetsLevel("advanced", "basic")).toBe(true);
    expect(meetsLevel("basic", "basic")).toBe(true);
  });

  it("rejects a level below the minimum", () => {
    expect(meetsLevel("basic", "advanced")).toBe(false);
    expect(meetsLevel("intermediate", "advanced")).toBe(false);
  });
});

describe("segmentDutyByCertification", () => {
  it("returns a single segment when nothing changes mid-duty", () => {
    const segments = segmentDutyByCertification(duty("d1", "r1", EVENT_START, EVENT_END), [
      cert("r1", "advanced"),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0].level).toBe("advanced");
  });

  it("splits the duty where a certification expires mid-shift", () => {
    const segments = segmentDutyByCertification(duty("d1", "r1", EVENT_START, EVENT_END), [
      cert("r1", "advanced", "2025-01-01T00:00:00Z", "2026-06-10T17:00:00Z"),
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0].level).toBe("advanced");
    expect(segments[1].level).toBeNull();
    expect(segments[0].endMs).toBe(at("2026-06-10T17:00:00Z"));
  });

  it("marks the whole duty uncertified when nothing is valid", () => {
    const segments = segmentDutyByCertification(duty("d1", "r1", EVENT_START, EVENT_END), [
      cert("r1", "basic", "2020-01-01T00:00:00Z", "2021-01-01T00:00:00Z"),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0].level).toBeNull();
  });

  it("ignores a zero-length or inverted duty", () => {
    expect(segmentDutyByCertification(duty("d1", "r1", EVENT_END, EVENT_START), [])).toEqual([]);
    expect(segmentDutyByCertification(duty("d1", "r1", EVENT_START, EVENT_START), [])).toEqual([]);
  });
});

describe("analyseCoverage — gaps", () => {
  it("reports full compliance when the whole window is covered", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.isCompliant).toBe(true);
    expect(analysis.gaps).toEqual([]);
    expect(analysis.totalGapMinutes).toBe(0);
  });

  it("finds the twenty-minute gap between two duty blocks", () => {
    // The issue's scenario: 16:00–16:20 has nobody on the ground.
    const analysis = analyseCoverage(
      [
        duty("d1", "r1", "2026-06-10T14:00:00Z", "2026-06-10T16:00:00Z"),
        duty("d2", "r2", "2026-06-10T16:20:00Z", "2026-06-10T20:00:00Z"),
      ],
      [cert("r1", "basic"), cert("r2", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );

    expect(analysis.isCompliant).toBe(false);
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].kind).toBe("no_cover");
    expect(analysis.gaps[0].durationMinutes).toBe(20);
    expect(analysis.gaps[0].startMs).toBe(at("2026-06-10T16:00:00Z"));
    expect(analysis.gaps[0].endMs).toBe(at("2026-06-10T16:20:00Z"));
  });

  it("finds an uncovered tail after the last duty block ends", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, "2026-06-10T18:00:00Z")],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].durationMinutes).toBe(120);
  });

  it("finds an uncovered head before the first duty block starts", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", "2026-06-10T15:00:00Z", EVENT_END)],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].startMs).toBe(at(EVENT_START));
    expect(analysis.gaps[0].durationMinutes).toBe(60);
  });

  it("reports the whole window uncovered when nobody is rostered", () => {
    const analysis = analyseCoverage([], [], EVENT_START, EVENT_END, "low");
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].durationMinutes).toBe(360);
    expect(complianceVerdict(analysis)).toBe("gaps_present");
  });

  it("counts a shortfall against a tier needing several responders", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "intermediate")],
      EVENT_START,
      EVENT_END,
      "high", // needs 3 concurrent
    );
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].kind).toBe("under_staffed");
    expect(analysis.gaps[0].qualifiedCount).toBe(1);
    expect(analysis.gaps[0].shortfall).toBe(2);
  });

  it("merges adjacent slices into one gap rather than fragments", () => {
    // Three responders arriving at staggered times leave one continuous
    // under-covered stretch, not three.
    const analysis = analyseCoverage(
      [duty("d1", "r1", "2026-06-10T18:00:00Z", EVENT_END)],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.gaps).toHaveLength(1);
  });
});

describe("analyseCoverage — certification", () => {
  it("stops counting a responder from the instant their certificate expires", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "basic", "2025-01-01T00:00:00Z", "2026-06-10T17:00:00Z")],
      EVENT_START,
      EVENT_END,
      "low",
    );

    expect(analysis.isCompliant).toBe(false);
    expect(analysis.gaps).toHaveLength(1);
    expect(analysis.gaps[0].startMs).toBe(at("2026-06-10T17:00:00Z"));
    expect(analysis.gaps[0].durationMinutes).toBe(180);
  });

  it("fails a tier that requires a level nobody on the roster holds", () => {
    const analysis = analyseCoverage(
      [
        duty("d1", "r1", EVENT_START, EVENT_END),
        duty("d2", "r2", EVENT_START, EVENT_END),
        duty("d3", "r3", EVENT_START, EVENT_END),
        duty("d4", "r4", EVENT_START, EVENT_END),
      ],
      [cert("r1", "basic"), cert("r2", "basic"), cert("r3", "basic"), cert("r4", "basic")],
      EVENT_START,
      EVENT_END,
      "extreme", // needs 4 concurrent ADVANCED
    );

    expect(analysis.isCompliant).toBe(false);
    expect(analysis.gaps[0].kind).toBe("under_certified");
    expect(complianceVerdict(analysis)).toBe("under_certified");
  });

  it("distinguishes nobody-present from present-but-under-certified", () => {
    const absent = analyseCoverage([], [], EVENT_START, EVENT_END, "low");
    const uncertified = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "extreme",
    );
    expect(absent.gaps[0].kind).toBe("no_cover");
    expect(uncertified.gaps[0].kind).toBe("under_certified");
  });

  it("names responders whose certification lapses mid-event", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "basic", "2025-01-01T00:00:00Z", "2026-06-10T17:00:00Z")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.expiringDuringEvent).toHaveLength(1);
    expect(analysis.expiringDuringEvent[0].responderId).toBe("r1");
  });

  it("does not flag a lapse the responder covers with another certificate", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [
        cert("r1", "advanced", "2025-01-01T00:00:00Z", "2026-06-10T17:00:00Z"),
        cert("r1", "basic", "2025-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
      ],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.expiringDuringEvent).toEqual([]);
    expect(analysis.isCompliant).toBe(true);
  });
});

describe("analyseCoverage — handovers", () => {
  it("flags two blocks that abut with no overlap", () => {
    const analysis = analyseCoverage(
      [
        duty("d1", "r1", EVENT_START, "2026-06-10T17:00:00Z"),
        duty("d2", "r2", "2026-06-10T17:00:00Z", EVENT_END),
      ],
      [cert("r1", "basic"), cert("r2", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    // Technically covered...
    expect(analysis.isCompliant).toBe(true);
    // ...but fragile.
    expect(analysis.fragileHandovers).toHaveLength(1);
    expect(analysis.fragileHandovers[0].outgoingResponderId).toBe("r1");
    expect(analysis.fragileHandovers[0].incomingResponderId).toBe("r2");
  });

  it("does not flag a handover with a real overlap", () => {
    const analysis = analyseCoverage(
      [
        duty("d1", "r1", EVENT_START, "2026-06-10T17:15:00Z"),
        duty("d2", "r2", "2026-06-10T17:00:00Z", EVENT_END),
      ],
      [cert("r1", "basic"), cert("r2", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.fragileHandovers).toEqual([]);
  });

  it("does not flag a boundary another responder spans", () => {
    const analysis = analyseCoverage(
      [
        duty("d1", "r1", EVENT_START, "2026-06-10T17:00:00Z"),
        duty("d2", "r2", "2026-06-10T17:00:00Z", EVENT_END),
        duty("d3", "r3", EVENT_START, EVENT_END),
      ],
      [cert("r1", "basic"), cert("r2", "basic"), cert("r3", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.fragileHandovers).toEqual([]);
  });
});

describe("analyseCoverage — bad input", () => {
  it("returns an empty analysis for an inverted event window", () => {
    const analysis = analyseCoverage([], [], EVENT_END, EVENT_START, "low");
    expect(analysis.slices).toEqual([]);
    expect(complianceVerdict(analysis)).toBe("no_roster");
  });

  it("clips duty blocks that extend beyond the event window", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", "2026-06-10T06:00:00Z", "2026-06-11T06:00:00Z")],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(analysis.isCompliant).toBe(true);
    expect(analysis.slices[0].startMs).toBe(at(EVENT_START));
    expect(analysis.slices[analysis.slices.length - 1].endMs).toBe(at(EVENT_END));
  });
});

describe("certificationsExpiringWithin", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("lists certificates lapsing inside the horizon, soonest first", () => {
    const expiring = certificationsExpiringWithin(
      [
        cert("r1", "basic", "2024-01-01T00:00:00Z", "2026-06-20T00:00:00Z"),
        cert("r2", "basic", "2024-01-01T00:00:00Z", "2026-06-05T00:00:00Z"),
        cert("r3", "basic", "2024-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
      ],
      30,
      now,
    );
    expect(expiring).toHaveLength(2);
    expect(expiring[0].certification.userId).toBe("r2");
    expect(expiring[0].daysRemaining).toBe(4);
  });

  it("includes already-expired certificates and marks them", () => {
    const expiring = certificationsExpiringWithin(
      [cert("r1", "basic", "2020-01-01T00:00:00Z", "2025-01-01T00:00:00Z")],
      30,
      now,
    );
    expect(expiring[0].isExpired).toBe(true);
    expect(expiring[0].daysRemaining).toBeLessThan(0);
  });

  it("excludes certificates well beyond the horizon", () => {
    expect(
      certificationsExpiringWithin(
        [cert("r1", "basic", "2025-01-01T00:00:00Z", "2028-01-01T00:00:00Z")],
        30,
        now,
      ),
    ).toEqual([]);
  });
});

describe("verdict and labels", () => {
  it("summarises a compliant roster", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, EVENT_END)],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(complianceVerdict(analysis)).toBe("compliant");
    expect(verdictSummary(analysis)).toMatch(/meets the low risk requirement/i);
  });

  it("summarises gaps with a total duration", () => {
    const analysis = analyseCoverage(
      [duty("d1", "r1", EVENT_START, "2026-06-10T18:00:00Z")],
      [cert("r1", "basic")],
      EVENT_START,
      EVENT_END,
      "low",
    );
    expect(verdictSummary(analysis)).toMatch(/1 coverage gap totalling 2h/);
  });

  it("reports an empty roster distinctly", () => {
    const analysis = analyseCoverage([], [], EVENT_END, EVENT_START, "low");
    expect(verdictSummary(analysis)).toMatch(/No responder duties/i);
  });

  it("labels every tier and certification level", () => {
    for (const tier of Object.keys(TIER_REQUIREMENTS) as Array<keyof typeof TIER_REQUIREMENTS>) {
      expect(tierLabel(tier).length).toBeGreaterThan(0);
    }
    expect(levelLabel("advanced")).toMatch(/paramedic/i);
  });

  it("formats gap durations readably", () => {
    expect(formatMinutes(20)).toBe("20 min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(95)).toBe("1h 35m");
  });
});
