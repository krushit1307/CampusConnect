import { describe, it, expect } from "vitest";
import {
  ENDORSEMENT_WINDOW_DAYS,
  MAX_COMMENT_LENGTH,
  MAX_SKILL_TAG_LENGTH,
  MIN_SKILL_TAG_LENGTH,
  SUGGESTED_SKILL_TAGS,
  TRUST_WEIGHTS,
  aggregateSkillEndorsements,
  buildProofPayload,
  buildRecruiterProfileLink,
  buildRecruiterSummaryText,
  endorsementStrength,
  endorsementStrengthLabel,
  eventHasEnded,
  formatWeightedScore,
  generateProofDigest,
  isWithinEndorsementWindow,
  isValidComment,
  isValidSkillTag,
  normalizeSkillTag,
  sha256,
  topSkills,
  trustTierForWeight,
  trustWeightForLegacyRole,
  trustWeightForPermissionsLevel,
  verifyProofDigest,
  type SkillEndorsementRecord,
} from "./skillEndorsements";

const NOW = new Date("2028-10-01T12:00:00.000Z");
const MS_PER_DAY = 86_400_000;

function iso(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * MS_PER_DAY).toISOString();
}

/** Minimal valid endorsement row for aggregation/digest tests. */
function row(overrides: Partial<SkillEndorsementRecord> = {}): SkillEndorsementRecord {
  return {
    id: `endo-${Math.random().toString(36).slice(2, 10)}`,
    user_id: "endorsee-1",
    endorser_user_id: "endorser-1",
    endorser_name: "Priya Sharma",
    endorser_handle: "priya",
    endorser_avatar: null,
    event_id: "event-1",
    event_title: "Spring Music Festival",
    club_name: "AV Club",
    skill_tag: "audio engineering",
    comment: "Ran the 32-channel mixer flawlessly across both stages.",
    endorser_weight: 1.0,
    attendance_proof: { method: "rsvp_check_in", event_id: "event-1" },
    proof_digest: null,
    created_at: iso(1),
    ...overrides,
  };
}

// ─── Skill-tag validation ───────────────────────────────────────────────────

describe("normalizeSkillTag", () => {
  it("lowercases, trims and collapses internal whitespace", () => {
    expect(normalizeSkillTag("  Audio   Engineering ")).toBe("audio engineering");
  });

  it("returns an empty string for nullish input", () => {
    expect(normalizeSkillTag(null as unknown as string)).toBe("");
    expect(normalizeSkillTag(undefined as unknown as string)).toBe("");
  });
});

describe("isValidSkillTag", () => {
  it("accepts the issue's scenario tags", () => {
    expect(isValidSkillTag("Audio Engineering")).toBe(true);
    expect(isValidSkillTag("A/V Technician")).toBe(true);
    expect(isValidSkillTag("C++")).toBe(true);
    expect(isValidSkillTag("Node.js")).toBe(true);
  });

  it("rejects tags that are too short or too long", () => {
    expect(isValidSkillTag("a")).toBe(false);
    expect(isValidSkillTag("x".repeat(MAX_SKILL_TAG_LENGTH + 1))).toBe(false);
  });

  it("rejects empty and charset-violating tags", () => {
    expect(isValidSkillTag("   ")).toBe(false);
    expect(isValidSkillTag("audio 🎧 engineering")).toBe(false);
    expect(isValidSkillTag("skill;drop")).toBe(false);
  });

  it("every suggested skill tag is valid", () => {
    for (const tag of SUGGESTED_SKILL_TAGS) {
      expect(isValidSkillTag(tag), `suggested tag "${tag}" should be valid`).toBe(true);
    }
  });

  it("exposes a minimum length of at least 2", () => {
    expect(MIN_SKILL_TAG_LENGTH).toBeGreaterThanOrEqual(2);
    expect(MAX_SKILL_TAG_LENGTH).toBeLessThanOrEqual(60);
  });
});

describe("isValidComment", () => {
  it("treats null, undefined and empty as valid (comment is optional)", () => {
    expect(isValidComment(null)).toBe(true);
    expect(isValidComment(undefined)).toBe(true);
    expect(isValidComment("   ")).toBe(true);
  });

  it("accepts a comment within the length bounds", () => {
    expect(isValidComment("Ran the 32-channel mixer flawlessly.")).toBe(true);
  });

  it("rejects a too-short or too-long comment", () => {
    expect(isValidComment("ab")).toBe(false);
    expect(isValidComment("x".repeat(MAX_COMMENT_LENGTH + 1))).toBe(false);
  });
});

// ─── Event timing ───────────────────────────────────────────────────────────

describe("eventHasEnded", () => {
  it("is false for missing dates", () => {
    expect(eventHasEnded(null)).toBe(false);
    expect(eventHasEnded(undefined)).toBe(false);
  });

  it("is true for a past end date and false for a future one", () => {
    expect(eventHasEnded(iso(2), NOW)).toBe(true);
    expect(eventHasEnded(iso(-2), NOW)).toBe(false);
  });
});

describe("isWithinEndorsementWindow", () => {
  it("opens after the event ends", () => {
    expect(isWithinEndorsementWindow(iso(1), NOW)).toBe(true);
  });

  it("is closed before the event ends", () => {
    expect(isWithinEndorsementWindow(iso(-1), NOW)).toBe(false);
  });

  it("closes exactly after the window elapses", () => {
    expect(isWithinEndorsementWindow(iso(ENDORSEMENT_WINDOW_DAYS), NOW)).toBe(true);
    expect(isWithinEndorsementWindow(iso(ENDORSEMENT_WINDOW_DAYS + 1), NOW)).toBe(false);
  });

  it("honours a custom window length", () => {
    expect(isWithinEndorsementWindow(iso(10), NOW, 5)).toBe(false);
    expect(isWithinEndorsementWindow(iso(3), NOW, 5)).toBe(true);
  });
});

// ─── Trust weighting ────────────────────────────────────────────────────────

describe("trust weights", () => {
  it("leadership outweighs officers, officers outweigh members", () => {
    expect(TRUST_WEIGHTS.leadership).toBeGreaterThan(TRUST_WEIGHTS.officer);
    expect(TRUST_WEIGHTS.officer).toBeGreaterThan(TRUST_WEIGHTS.member);
    expect(TRUST_WEIGHTS.member).toBeGreaterThan(TRUST_WEIGHTS.nonMember);
  });

  it("maps dynamic permissions levels to tiers", () => {
    expect(trustWeightForPermissionsLevel(100)).toBe(TRUST_WEIGHTS.leadership);
    expect(trustWeightForPermissionsLevel(250)).toBe(TRUST_WEIGHTS.leadership);
    expect(trustWeightForPermissionsLevel(40)).toBe(TRUST_WEIGHTS.officer);
    expect(trustWeightForPermissionsLevel(99)).toBe(TRUST_WEIGHTS.officer);
    expect(trustWeightForPermissionsLevel(10)).toBe(TRUST_WEIGHTS.member);
    expect(trustWeightForPermissionsLevel(null)).toBe(TRUST_WEIGHTS.nonMember);
  });

  it("maps legacy roles to tiers", () => {
    expect(trustWeightForLegacyRole("owner")).toBe(TRUST_WEIGHTS.leadership);
    expect(trustWeightForLegacyRole("admin")).toBe(TRUST_WEIGHTS.leadership);
    expect(trustWeightForLegacyRole("president")).toBe(TRUST_WEIGHTS.leadership);
    expect(trustWeightForLegacyRole("officer")).toBe(TRUST_WEIGHTS.officer);
    expect(trustWeightForLegacyRole("member")).toBe(TRUST_WEIGHTS.member);
    expect(trustWeightForLegacyRole(undefined)).toBe(TRUST_WEIGHTS.nonMember);
  });

  it("labels a weight with its tier", () => {
    expect(trustTierForWeight(1.0)).toBe("leadership");
    expect(trustTierForWeight(0.85)).toBe("officer");
    expect(trustTierForWeight(0.6)).toBe("member");
    expect(trustTierForWeight(0.5)).toBe("nonMember");
  });
});

// ─── Cryptographic proof ────────────────────────────────────────────────────

describe("proof digest", () => {
  it("builds a canonical, versioned, pipe-delimited payload", () => {
    expect(
      buildProofPayload({
        userId: "u1",
        endorserId: "u2",
        eventId: "e1",
        skillTag: "Audio  Engineering",
      }),
    ).toBe("skill_endorsement:v1|u1|u2|e1|audio engineering");
  });

  it("produces a stable 64-character lowercase hex digest", async () => {
    const input = { userId: "u1", endorserId: "u2", eventId: "e1", skillTag: "Audio Engineering" };
    const first = await generateProofDigest(input);
    const second = await generateProofDigest(input);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when any canonical field changes", async () => {
    const base = await generateProofDigest({
      userId: "u1",
      endorserId: "u2",
      eventId: "e1",
      skillTag: "audio engineering",
    });
    const changedUser = await generateProofDigest({
      userId: "u9",
      endorserId: "u2",
      eventId: "e1",
      skillTag: "audio engineering",
    });
    const changedEvent = await generateProofDigest({
      userId: "u1",
      endorserId: "u2",
      eventId: "e9",
      skillTag: "audio engineering",
    });
    const changedSkill = await generateProofDigest({
      userId: "u1",
      endorserId: "u2",
      eventId: "e1",
      skillTag: "stage management",
    });
    expect(base).not.toBe(changedUser);
    expect(base).not.toBe(changedEvent);
    expect(base).not.toBe(changedSkill);
  });

  it("verifies a row whose digest matches the recomputation", async () => {
    const record = row();
    record.proof_digest = await generateProofDigest({
      userId: record.user_id,
      endorserId: record.endorser_user_id,
      eventId: record.event_id,
      skillTag: record.skill_tag,
    });
    await expect(verifyProofDigest(record)).resolves.toBe(true);
  });

  it("rejects a row with a tampered digest", async () => {
    const record = row();
    record.proof_digest = await generateProofDigest({
      userId: record.user_id,
      endorserId: record.endorser_user_id,
      eventId: "some-other-event",
      skillTag: record.skill_tag,
    });
    await expect(verifyProofDigest(record)).resolves.toBe(false);
  });

  it("rejects a row with a missing digest", async () => {
    const record = row({ proof_digest: null });
    await expect(verifyProofDigest(record)).resolves.toBe(false);
  });

  it("is case-insensitive against the stored digest", async () => {
    const record = row();
    record.proof_digest = (
      await generateProofDigest({
        userId: record.user_id,
        endorserId: record.endorser_user_id,
        eventId: record.event_id,
        skillTag: record.skill_tag,
      })
    ).toUpperCase();
    await expect(verifyProofDigest(record)).resolves.toBe(true);
  });

  it("matches the WebCrypto digest byte for byte when both are available", async () => {
    const payload = buildProofPayload({
      userId: "u1",
      endorserId: "u2",
      eventId: "e1",
      skillTag: "audio engineering",
    });
    const bytes = new TextEncoder().encode(payload);
    let hex = "";
    for (const byte of sha256(bytes)) {
      hex += byte.toString(16).padStart(2, "0");
    }
    const viaCrypto = await generateProofDigest({
      userId: "u1",
      endorserId: "u2",
      eventId: "e1",
      skillTag: "audio engineering",
    });
    expect(hex).toBe(viaCrypto);
  });
});

describe("sha256 fallback (FIPS 180-4 vectors)", () => {
  it("hashes the empty string to the reference digest", () => {
    const hex = toHex(sha256(new TextEncoder().encode("")));
    expect(hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("hashes 'abc' to the reference digest", () => {
    const hex = toHex(sha256(new TextEncoder().encode("abc")));
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("handles inputs crossing the 64-byte block boundary", () => {
    // 100 'a' characters spans two padded blocks.
    const hex = toHex(sha256(new TextEncoder().encode("a".repeat(100))));
    expect(hex).toBe("2816597888e4a0d3a36b82b83316ab32680eb8f00f8cd3b904d681246d285a0e");
    // Exactly 55 bytes: the 0x80 pad byte and length still fit in one block.
    const hex55 = toHex(sha256(new TextEncoder().encode("a".repeat(55))));
    expect(hex55).toBe("9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318");
    // Exactly 56 bytes: padding spills into a second block.
    const hex56 = toHex(sha256(new TextEncoder().encode("a".repeat(56))));
    expect(hex56).toBe("b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a");
    // A full block of 64 bytes.
    const hex64 = toHex(sha256(new TextEncoder().encode("a".repeat(64))));
    expect(hex64).toBe("ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");
  });

  it("hashes a longer multi-block input consistently", () => {
    const first = toHex(sha256(new TextEncoder().encode("a".repeat(100))));
    const second = toHex(sha256(new TextEncoder().encode("a".repeat(100))));
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

// ─── Aggregation ────────────────────────────────────────────────────────────

describe("aggregateSkillEndorsements", () => {
  it("groups by skill and sums endorser weights", () => {
    const summaries = aggregateSkillEndorsements([
      row({ endorser_user_id: "president", endorser_weight: 1.0 }),
      row({ endorser_user_id: "officer", endorser_weight: 0.85 }),
      row({ endorser_user_id: "peer", endorser_weight: 0.6 }),
    ]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].skillTag).toBe("audio engineering");
    expect(summaries[0].weightedScore).toBeCloseTo(2.45, 3);
    expect(summaries[0].distinctEndorsers).toBe(3);
    expect(summaries[0].endorsementCount).toBe(3);
  });

  it("ranks skills by weighted score, descending", () => {
    const summaries = aggregateSkillEndorsements([
      row({ skill_tag: "stage management", endorser_weight: 0.6 }),
      row({ skill_tag: "audio engineering", endorser_user_id: "a", endorser_weight: 1.0 }),
      row({ skill_tag: "audio engineering", endorser_user_id: "b", endorser_weight: 0.85 }),
    ]);
    expect(summaries[0].skillTag).toBe("audio engineering");
    expect(summaries[1].skillTag).toBe("stage management");
  });

  it("normalises skill tags before grouping", () => {
    const summaries = aggregateSkillEndorsements([
      row({ skill_tag: "Audio Engineering" }),
      row({ skill_tag: "audio   engineering", endorser_user_id: "other" }),
    ]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].endorsementCount).toBe(2);
  });

  it("counts each endorser at most once per skill", () => {
    const summaries = aggregateSkillEndorsements([
      row({ endorser_user_id: "president", endorser_weight: 1.0 }),
      row({ endorser_user_id: "president", endorser_weight: 1.0 }),
    ]);
    expect(summaries[0].endorsementCount).toBe(1);
    expect(summaries[0].weightedScore).toBeCloseTo(1.0, 3);
  });

  it("tracks the most recent endorsement per skill", () => {
    const summaries = aggregateSkillEndorsements([
      row({ created_at: iso(10) }),
      row({ endorser_user_id: "b", created_at: iso(2) }),
    ]);
    expect(summaries[0].lastEndorsedAt).toBe(iso(2));
  });

  it("returns an empty array for no records", () => {
    expect(aggregateSkillEndorsements([])).toEqual([]);
  });

  it("survives a missing endorser weight", () => {
    const summaries = aggregateSkillEndorsements([
      row({ endorser_weight: undefined as unknown as number }),
    ]);
    expect(summaries[0].weightedScore).toBe(0);
    expect(summaries[0].distinctEndorsers).toBe(1);
  });
});

describe("topSkills", () => {
  const summaries = aggregateSkillEndorsements([
    row({ skill_tag: "alpha" }),
    row({ skill_tag: "beta", endorser_user_id: "x" }),
    row({ skill_tag: "gamma", endorser_user_id: "y" }),
  ]);

  it("slices the ranked list", () => {
    expect(topSkills(summaries, 2)).toHaveLength(2);
  });

  it("returns everything when the limit exceeds the list", () => {
    expect(topSkills(summaries, 99)).toHaveLength(3);
  });
});

describe("strength labels", () => {
  it("upgrades as evidence accumulates", () => {
    expect(endorsementStrength(0.6)).toBe("emerging");
    expect(endorsementStrength(1.0)).toBe("emerging");
    expect(endorsementStrength(1.5)).toBe("verified");
    expect(endorsementStrength(2.5)).toBe("highly_verified");
  });

  it("labels are human-readable", () => {
    expect(endorsementStrengthLabel(0.6)).toBe("Emerging");
    expect(endorsementStrengthLabel(1.8)).toBe("Verified");
    expect(endorsementStrengthLabel(3.2)).toBe("Highly Verified");
  });

  it("formats a weighted score to two decimals", () => {
    expect(formatWeightedScore(2.4499999999999997)).toBe("2.45");
  });
});

// ─── Recruiter sharing ──────────────────────────────────────────────────────

describe("buildRecruiterProfileLink", () => {
  it("builds an absolute link from an explicit origin", () => {
    expect(buildRecruiterProfileLink("alex", "https://campus.example.edu")).toBe(
      "https://campus.example.edu/profile/alex",
    );
  });

  it("escapes handles that need encoding", () => {
    expect(buildRecruiterProfileLink("alex/d", "https://campus.example.edu")).toBe(
      "https://campus.example.edu/profile/alex%2Fd",
    );
  });

  it("resolves an absolute link from the ambient browser origin when none is given", () => {
    // In a browser (or jsdom) the ambient origin is used; where no window
    // exists at all the link degrades gracefully to a relative path.
    expect(buildRecruiterProfileLink("alex")).toMatch(/^(https?:\/\/[^/]+)?\/profile\/alex$/);
  });

  it("returns a relative link when the origin is empty", () => {
    expect(buildRecruiterProfileLink("alex", "")).toBe("/profile/alex");
  });
});

describe("buildRecruiterSummaryText", () => {
  const summaries = aggregateSkillEndorsements([
    row({ skill_tag: "audio engineering", endorser_user_id: "president", endorser_weight: 1.0 }),
    row({
      endorser_user_id: "officer",
      endorser_weight: 0.85,
      endorser_name: "Officer Ollie",
      comment: "Flawless 32-channel mix.",
    }),
  ]);

  it("mentions the person, the skill, the strength and the link", () => {
    const text = buildRecruiterSummaryText(
      "Alex Rivera",
      summaries,
      "https://campus.example.edu/profile/alex",
    );
    expect(text).toContain("Alex Rivera");
    expect(text).toContain("audio engineering");
    expect(text).toContain("Verified");
    expect(text).toContain("2 endorsers");
    expect(text).toContain("https://campus.example.edu/profile/alex");
  });

  it("quotes endorser comments", () => {
    const text = buildRecruiterSummaryText("Alex Rivera", summaries, "/profile/alex");
    expect(text).toContain('"Flawless 32-channel mix."');
  });

  it("handles an empty skill list gracefully", () => {
    const text = buildRecruiterSummaryText("Alex Rivera", [], "/profile/alex");
    expect(text).toContain("none yet");
    expect(text).toContain("/profile/alex");
  });
});
