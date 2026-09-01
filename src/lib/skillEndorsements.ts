// src/lib/skillEndorsements.ts
// -----------------------------------------------------------------------------
// Issue #3677 — Dynamic "Skill Endorsement" System
//
// Pure helpers for the skill-endorsement feature. Deliberately free of React
// and Supabase imports so the maths and the digest canonicalisation can be
// unit-tested in isolation and reused by the organizer endorsement panel,
// the public profile section and any future cron/edge job.
//
// The contract in one paragraph: an endorsement is a row in
// `public.skill_endorsements` written exclusively by the
// `endorse_volunteer_skill()` SECURITY DEFINER RPC. The RPC refuses to write
// unless the volunteer actually attended the event (checked-in RSVP or an
// attended/late shift outcome), the event has ended, the caller is the
// event's organizer, and the endorsement is made inside the 30-day window
// after the event ended. Every row carries `endorser_weight` — the trust
// score of the endorser (club president = 1.0, officer = 0.85, member = 0.6)
// — and a `proof_digest`: SHA-256 over the canonical payload
// "skill_endorsement:v1|user|endorser|event|skill". The database trigger
// recomputes that digest on every write, so a fabricated row cannot be
// stored, and the browser can re-verify any row it reads using the exact
// canonicalisation below.
// -----------------------------------------------------------------------------

/** Days after an event ends during which endorsements may still be written. */
export const ENDORSEMENT_WINDOW_DAYS = 30;

/** Skill tags are stored lowercase, trimmed, with single internal spaces. */
export const MIN_SKILL_TAG_LENGTH = 2;
export const MAX_SKILL_TAG_LENGTH = 40;
export const MIN_COMMENT_LENGTH = 3;
export const MAX_COMMENT_LENGTH = 300;

/**
 * Trust weights mirrored from `endorser_trust_weight()` in the database.
 * An endorsement from a club president is worth more than one from a peer.
 */
export const TRUST_WEIGHTS = {
  /** Club creator / president / owner / admin-tier (permissions >= 100). */
  leadership: 1.0,
  /** Officer-tier roles (permissions 40–99, or legacy 'officer'). */
  officer: 0.85,
  /** Ordinary approved club members. */
  member: 0.6,
  /** Anyone with no standing in the club running the event. */
  nonMember: 0.5,
} as const;

export type TrustTier = keyof typeof TRUST_WEIGHTS;

/**
 * Canonical charset for a normalised skill tag: lowercase alphanumerics,
 * spaces, `./&+()-`. "A/V Technician" normalises to "a/v technician";
 * "C++" is representable; emojis and other unicode are not.
 */
const SKILL_TAG_PATTERN = /^[a-z0-9][a-z0-9 ./&+()-]*$/;

/** Suggested tags offered in the organizer UI (from the issue's scenario). */
export const SUGGESTED_SKILL_TAGS: readonly string[] = [
  "Audio Engineering",
  "A/V Technician",
  "Stage Management",
  "Lighting Design",
  "Event Production",
  "Live Sound Mixing",
  "Public Speaking",
  "Team Leadership",
  "Crowd Management",
  "Fundraising",
  "Graphic Design",
  "Social Media Marketing",
  "Project Management",
  "Logistics Coordination",
  "First Aid",
  "Photography",
  "Videography",
  "Web Development",
  "Budgeting",
  "Mentoring",
];

/** Raw endorsement row as returned by `get_user_skill_endorsements()`. */
export interface SkillEndorsementRecord {
  id: string;
  user_id: string;
  endorser_user_id: string;
  endorser_name: string | null;
  endorser_handle: string | null;
  endorser_avatar: string | null;
  event_id: string;
  event_title: string | null;
  club_name: string | null;
  skill_tag: string;
  comment: string | null;
  endorser_weight: number;
  attendance_proof: Record<string, unknown> | null;
  proof_digest: string | null;
  created_at: string;
}

/** Aggregated per-skill view used by the public profile section. */
export interface SkillEndorsementSummary {
  skillTag: string;
  /** Sum of endorser trust weights across distinct endorsers. */
  weightedScore: number;
  endorsementCount: number;
  distinctEndorsers: number;
  lastEndorsedAt: string | null;
  /** The individual endorsements behind the number. */
  endorsements: SkillEndorsementRecord[];
}

/** How strong a skill's verified evidence is, for badges/labels. */
export type EndorsementStrength = "highly_verified" | "verified" | "emerging";

export const STRENGTH_THRESHOLDS: Array<{
  strength: EndorsementStrength;
  min: number;
  label: string;
}> = [
  { strength: "highly_verified", min: 2.5, label: "Highly Verified" },
  { strength: "verified", min: 1.5, label: "Verified" },
  { strength: "emerging", min: 0, label: "Emerging" },
];

// ─── Skill-tag validation ───────────────────────────────────────────────────

/**
 * Lowercase, trim and collapse internal whitespace. Must match
 * `public.normalize_skill_tag()` in the database exactly — the digest
 * canonicalisation depends on both sides agreeing.
 */
export function normalizeSkillTag(tag: string): string {
  return (tag ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the tag is normalised, the right length and charset. */
export function isValidSkillTag(tag: string): boolean {
  const normalized = normalizeSkillTag(tag);
  return (
    normalized.length >= MIN_SKILL_TAG_LENGTH &&
    normalized.length <= MAX_SKILL_TAG_LENGTH &&
    SKILL_TAG_PATTERN.test(normalized)
  );
}

/** Comments are optional but must be 3–300 characters when present. */
export function isValidComment(comment: string | null | undefined): boolean {
  if (comment === null || comment === undefined) return true;
  const trimmed = comment.trim();
  if (trimmed.length === 0) return true;
  return trimmed.length >= MIN_COMMENT_LENGTH && trimmed.length <= MAX_COMMENT_LENGTH;
}

// ─── Event timing ───────────────────────────────────────────────────────────

/**
 * True when the event (whose latest known end timestamp is `endedAt`) has
 * finished. Events with no date at all have not ended.
 */
export function eventHasEnded(endedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!endedAt) return false;
  return new Date(endedAt).getTime() <= now.getTime();
}

/**
 * True when the event has ended *and* the 30-day endorsement window is still
 * open. After the window closes the database RPC refuses new endorsements,
 * and the UI hides the prompt to match.
 */
export function isWithinEndorsementWindow(
  endedAt: string | null | undefined,
  now: Date = new Date(),
  windowDays: number = ENDORSEMENT_WINDOW_DAYS,
): boolean {
  if (!eventHasEnded(endedAt, now)) return false;
  const ended = new Date(endedAt as string).getTime();
  return now.getTime() <= ended + windowDays * 24 * 60 * 60 * 1000;
}

// ─── Trust weighting (mirrors endorser_trust_weight() in the database) ──────

/** Resolve the trust weight for a dynamic `club_roles` permissions level. */
export function trustWeightForPermissionsLevel(level: number | null | undefined): number {
  if (level === null || level === undefined) return TRUST_WEIGHTS.nonMember;
  if (level >= 100) return TRUST_WEIGHTS.leadership;
  if (level >= 40) return TRUST_WEIGHTS.officer;
  return TRUST_WEIGHTS.member;
}

/**
 * Resolve the trust weight for a legacy `club_members.role` value.
 * Presidents/owners/admins outweigh officers, who outweigh members.
 */
export function trustWeightForLegacyRole(role: string | null | undefined): number {
  switch ((role ?? "").toLowerCase()) {
    case "owner":
    case "admin":
    case "president":
      return TRUST_WEIGHTS.leadership;
    case "officer":
      return TRUST_WEIGHTS.officer;
    case "member":
      return TRUST_WEIGHTS.member;
    default:
      return TRUST_WEIGHTS.nonMember;
  }
}

/** Human label for a weight, e.g. 1.0 -> "Club leadership". */
export function trustTierForWeight(weight: number): TrustTier {
  if (weight >= 0.95) return "leadership";
  if (weight >= 0.75) return "officer";
  if (weight >= 0.55) return "member";
  return "nonMember";
}

// ─── Cryptographic proof (matches build_endorsement_proof_digest()) ─────────

export interface EndorsementProofInput {
  userId: string;
  endorserId: string;
  eventId: string;
  skillTag: string;
}

/**
 * The canonical string that gets hashed. Pipe-delimited and versioned so the
 * format can evolve without ambiguity. Both the database function and this
 * module must agree on it byte for byte.
 */
export function buildProofPayload(input: EndorsementProofInput): string {
  return [
    "skill_endorsement:v1",
    input.userId,
    input.endorserId,
    input.eventId,
    normalizeSkillTag(input.skillTag),
  ].join("|");
}

/** SHA-256 hex digest of the canonical payload. */
export async function generateProofDigest(input: EndorsementProofInput): Promise<string> {
  const payload = buildProofPayload(input);
  const data = new TextEncoder().encode(payload);
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", data);
    return toHex(new Uint8Array(digest));
  }
  // Fallback for environments without WebCrypto (e.g. jsdom): a compact
  // pure-JS SHA-256 producing byte-identical output.
  return toHex(sha256(data));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

// ─── Pure-JS SHA-256 (WebCrypto fallback) ───────────────────────────────────
// Standard FIPS 180-4 implementation; used only when crypto.subtle is absent.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Pure-JS SHA-256 over raw bytes. Matches WebCrypto's "SHA-256" exactly. */
export function sha256(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const blockCount = ((message.length + 8) >> 6) + 1;
  const padded = new Uint8Array(blockCount * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let j = 0; j < 16; j += 1) {
      w[j] = view.getUint32(block + j * 4);
    }
    for (let j = 16; j < 64; j += 1) {
      const x = w[j - 15];
      const y = w[j - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j += 1) {
      const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + bigS1 + choose + SHA256_K[j] + w[j]) >>> 0;
      const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigS0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0);
  outView.setUint32(4, h1);
  outView.setUint32(8, h2);
  outView.setUint32(12, h3);
  outView.setUint32(16, h4);
  outView.setUint32(20, h5);
  outView.setUint32(24, h6);
  outView.setUint32(28, h7);
  return out;
}

/**
 * Independently verify an endorsement row read from the database by
 * recomputing its digest. Rows that fail should be treated as suspect —
 * in practice the DB trigger makes them impossible to store.
 */
export async function verifyProofDigest(record: {
  user_id: string;
  endorser_user_id: string;
  event_id: string;
  skill_tag: string;
  proof_digest: string | null;
}): Promise<boolean> {
  if (!record.proof_digest) return false;
  const expected = await generateProofDigest({
    userId: record.user_id,
    endorserId: record.endorser_user_id,
    eventId: record.event_id,
    skillTag: record.skill_tag,
  });
  return expected === record.proof_digest.toLowerCase();
}

/** Verify many rows at once; returns a map of endorsement id -> verified. */
export async function verifyProofDigests(
  records: Array<{
    id: string;
    user_id: string;
    endorser_user_id: string;
    event_id: string;
    skill_tag: string;
    proof_digest: string | null;
  }>,
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  for (const record of records) {
    results.set(record.id, await verifyProofDigest(record));
  }
  return results;
}

// ─── Aggregation ────────────────────────────────────────────────────────────

/**
 * Group raw endorsements into per-skill summaries, ranked by weighted score
 * (then distinct endorser count). Defensive against duplicate endorser rows:
 * the same endorser only counts once per skill, keeping the client honest
 * even if the server is ever lenient.
 */
export function aggregateSkillEndorsements(
  records: SkillEndorsementRecord[],
): SkillEndorsementSummary[] {
  const bySkill = new Map<string, SkillEndorsementSummary>();

  for (const record of records) {
    const skillTag = normalizeSkillTag(record.skill_tag);
    let summary = bySkill.get(skillTag);
    if (!summary) {
      summary = {
        skillTag,
        weightedScore: 0,
        endorsementCount: 0,
        distinctEndorsers: 0,
        lastEndorsedAt: null,
        endorsements: [],
      };
      bySkill.set(skillTag, summary);
    }

    const alreadyEndorsed = summary.endorsements.some(
      (existing) => existing.endorser_user_id === record.endorser_user_id,
    );
    if (alreadyEndorsed) continue;

    summary.endorsements.push(record);
    summary.endorsementCount += 1;
    summary.distinctEndorsers += 1;
    summary.weightedScore += Number(record.endorser_weight) || 0;
    if (
      !summary.lastEndorsedAt ||
      new Date(record.created_at).getTime() > new Date(summary.lastEndorsedAt).getTime()
    ) {
      summary.lastEndorsedAt = record.created_at;
    }
  }

  return Array.from(bySkill.values())
    .map((summary) => ({
      ...summary,
      weightedScore: Math.round(summary.weightedScore * 1000) / 1000,
    }))
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        b.distinctEndorsers - a.distinctEndorsers ||
        a.skillTag.localeCompare(b.skillTag),
    );
}

/** The top N skills by weighted score. */
export function topSkills(
  summaries: SkillEndorsementSummary[],
  limit: number,
): SkillEndorsementSummary[] {
  return summaries.slice(0, Math.max(0, limit));
}

/** Strength label for a skill's weighted score. */
export function endorsementStrength(weightedScore: number): EndorsementStrength {
  for (const threshold of STRENGTH_THRESHOLDS) {
    if (weightedScore >= threshold.min) return threshold.strength;
  }
  return "emerging";
}

/** Human label, e.g. "Highly Verified". */
export function endorsementStrengthLabel(weightedScore: number): string {
  return STRENGTH_THRESHOLDS.find((t) => weightedScore >= t.min)?.label ?? "Emerging";
}

/** "2.45" style display of a weighted score. */
export function formatWeightedScore(weightedScore: number): string {
  return weightedScore.toFixed(2);
}

// ─── Recruiter sharing ──────────────────────────────────────────────────────

/**
 * The public profile URL tailored for sharing with recruiters. Uses the
 * current origin when running in a browser; otherwise a relative URL.
 */
export function buildRecruiterProfileLink(handle: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" && typeof window.location?.origin === "string"
      ? window.location.origin
      : "");
  return `${base}/profile/${encodeURIComponent(handle)}`;
}

/**
 * A plain-text, resume-ready summary of verified skills, so a student can
 * paste their credentials straight into an application email.
 */
export function buildRecruiterSummaryText(
  displayName: string,
  summaries: SkillEndorsementSummary[],
  profileLink: string,
): string {
  if (summaries.length === 0) {
    return `${displayName}'s verified skills (CampusConnect): none yet.\n${profileLink}`;
  }
  const lines = summaries.map((summary) => {
    const detail = summary.endorsements
      .map((endorsement) => {
        const endorser =
          endorsement.endorser_name || endorsement.endorser_handle || "A club organizer";
        const weight =
          endorsement.endorser_weight >= 0.95
            ? "club leadership"
            : endorsement.endorser_weight >= 0.75
              ? "club officer"
              : "verified organizer";
        const event = endorsement.event_title ? ` at "${endorsement.event_title}"` : "";
        const note = endorsement.comment ? ` — "${endorsement.comment}"` : "";
        return `  - ${endorser} (${weight}${event})${note}`;
      })
      .join("\n");
    return `${summary.skillTag} — ${endorsementStrengthLabel(summary.weightedScore)} (${formatWeightedScore(
      summary.weightedScore,
    )} from ${summary.distinctEndorsers} endorser${summary.distinctEndorsers === 1 ? "" : "s"}):\n${detail}`;
  });
  return `${displayName}'s verified skills (CampusConnect):\n\n${lines.join("\n\n")}\n\n${profileLink}`;
}
