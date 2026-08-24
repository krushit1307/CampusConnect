/**
 * Module: Event Waste Diversion Audit & Contamination Scorecard
 * File: src/services/eventWasteDiversionService.ts
 * Scope: Records measured disposal weights per event, computes a true diversion
 *        rate with contamination reclassified into landfill, and grades an event
 *        against the club's own history rather than an arbitrary target (#4387).
 *
 * The important idea here is that a diversion rate taken at face value lies. A
 * recycling bag with food scraps in it is landfill, whatever the bin said, so
 * the contaminated fraction of every diverted stream is moved to landfill
 * before the ratio is taken. Reporting the naive number is how a club ends up
 * believing an intervention worked when it did not.
 */

export type WasteStreamType = "LANDFILL" | "RECYCLING" | "COMPOST" | "DONATED";

export type DiversionGrade = "A" | "B" | "C" | "D" | "F";

export type AuditFlag = "CONTAMINATION_CRITICAL" | "NO_MEASUREMENT" | "HIGH_INTENSITY";

/** Streams that count toward diversion when they are clean. */
export const DIVERTED_STREAMS: readonly WasteStreamType[] = ["RECYCLING", "COMPOST", "DONATED"];

/** A single diverted stream above this contamination is operator-fixable. */
export const CONTAMINATION_CRITICAL_PERCENT = 20;

/** Waste per attendee above this is flagged regardless of diversion rate. */
export const HIGH_INTENSITY_KG_PER_ATTENDEE = 1.5;

/** Grade bands, ordered from best to worst. */
const GRADE_BANDS: ReadonlyArray<{ minRate: number; grade: DiversionGrade }> = [
  { minRate: 0.8, grade: "A" },
  { minRate: 0.65, grade: "B" },
  { minRate: 0.5, grade: "C" },
  { minRate: 0.3, grade: "D" },
  { minRate: 0, grade: "F" },
];

export interface WasteStreamRecord {
  streamType: WasteStreamType;
  /** Measured gross weight in kilograms. */
  grossWeightKg: number;
  /**
   * Share of this stream, 0-100, that does not belong in it. Only meaningful
   * for diverted streams; a landfill stream cannot be contaminated because
   * everything in it is already going to landfill.
   */
  contaminationPercent: number;
  containerCount: number;
  recordedBy: string;
  recordedAt: Date;
}

export interface StreamBreakdown {
  streamType: WasteStreamType;
  grossWeightKg: number;
  contaminationPercent: number;
  /** Mass that genuinely reached the diverted destination. */
  effectiveDivertedKg: number;
  /** Mass reclassified into landfill because of contamination. */
  reclassifiedToLandfillKg: number;
  containerCount: number;
}

export interface WasteAudit {
  eventId: string;
  clubId: string;
  eventName: string;
  attendance: number;
  totalWasteKg: number;
  divertedKg: number;
  landfillKg: number;
  /** Diverted mass over total mass, after contamination reclassification. */
  diversionRate: number;
  /** The rate the club would have reported without a contamination check. */
  naiveDiversionRate: number;
  grade: DiversionGrade;
  intensityKgPerAttendee: number;
  streams: StreamBreakdown[];
  flags: AuditFlag[];
  finalized: boolean;
  finalizedAt: Date | null;
}

export interface ClubTrendPoint {
  eventId: string;
  eventName: string;
  diversionRate: number;
  grade: DiversionGrade;
  intensityKgPerAttendee: number;
  /** Change in diversion rate against the club's previous audit. */
  deltaVsPrevious: number | null;
  finalizedAt: Date | null;
}

export interface ClubTrend {
  clubId: string;
  auditCount: number;
  averageDiversionRate: number;
  bestDiversionRate: number;
  worstDiversionRate: number;
  /** Positive when the club's recent audits beat its earlier ones. */
  trendDirection: "IMPROVING" | "FLAT" | "DECLINING";
  points: ClubTrendPoint[];
}

interface AuditInput {
  eventId: string;
  clubId: string;
  eventName: string;
  attendance: number;
}

export class EventWasteDiversionService {
  private readonly streams: Map<string, WasteStreamRecord[]>;
  private readonly audits: Map<string, WasteAudit>;

  constructor() {
    this.streams = new Map();
    this.audits = new Map();
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /**
   * Records one weighed disposal stream for an event.
   *
   * Recording the same stream type twice is legitimate — a large fest fills the
   * recycling skip more than once — so the records accumulate and are merged at
   * computation time rather than overwriting each other.
   */
  public recordStream(eventId: string, record: WasteStreamRecord): void {
    this.assertNotFinalized(eventId);

    if (!eventId || !eventId.trim()) {
      throw new Error("A waste stream record requires an event id.");
    }
    if (!Number.isFinite(record.grossWeightKg) || record.grossWeightKg < 0) {
      throw new Error(
        `Gross weight for the ${record.streamType} stream must be a non-negative number.`,
      );
    }
    if (
      !Number.isFinite(record.contaminationPercent) ||
      record.contaminationPercent < 0 ||
      record.contaminationPercent > 100
    ) {
      throw new Error("Contamination must be expressed as a percentage between 0 and 100.");
    }
    if (!Number.isInteger(record.containerCount) || record.containerCount < 0) {
      throw new Error("Container count must be a non-negative whole number.");
    }
    if (record.streamType === "LANDFILL" && record.contaminationPercent > 0) {
      // Everything in the landfill stream is already going to landfill, so a
      // contamination figure on it is meaningless and almost always a data
      // entry slip worth surfacing rather than silently ignoring.
      throw new Error("A landfill stream cannot carry a contamination percentage.");
    }

    const existing = this.streams.get(eventId) ?? [];
    existing.push({ ...record });
    this.streams.set(eventId, existing);
  }

  public getStreams(eventId: string): WasteStreamRecord[] {
    return [...(this.streams.get(eventId) ?? [])];
  }

  // ---------------------------------------------------------------------------
  // Computation
  // ---------------------------------------------------------------------------

  /**
   * Collapses the recorded streams into one breakdown per stream type, applying
   * the contamination reclassification.
   *
   * A 40 kg recycling stream at 25% contamination contributes 30 kg diverted
   * and 10 kg landfill. It does not contribute 40 kg diverted.
   */
  public buildStreamBreakdown(eventId: string): StreamBreakdown[] {
    const records = this.streams.get(eventId) ?? [];
    const byType = new Map<WasteStreamType, StreamBreakdown>();

    for (const record of records) {
      const isDiverted = DIVERTED_STREAMS.includes(record.streamType);
      const contaminatedKg = isDiverted
        ? (record.grossWeightKg * record.contaminationPercent) / 100
        : 0;
      const effectiveDivertedKg = isDiverted ? record.grossWeightKg - contaminatedKg : 0;
      const reclassifiedToLandfillKg = isDiverted ? contaminatedKg : record.grossWeightKg;

      const current = byType.get(record.streamType);
      if (!current) {
        byType.set(record.streamType, {
          streamType: record.streamType,
          grossWeightKg: record.grossWeightKg,
          contaminationPercent: record.contaminationPercent,
          effectiveDivertedKg,
          reclassifiedToLandfillKg,
          containerCount: record.containerCount,
        });
        continue;
      }

      const combinedGross = current.grossWeightKg + record.grossWeightKg;
      const combinedReclassified = current.reclassifiedToLandfillKg + reclassifiedToLandfillKg;

      byType.set(record.streamType, {
        streamType: record.streamType,
        grossWeightKg: combinedGross,
        // Mass-weighted, so a 100 kg skip at 5% is not averaged flat against a
        // 2 kg bin at 90%.
        contaminationPercent: isDiverted
          ? this.round2(combinedGross === 0 ? 0 : (combinedReclassified / combinedGross) * 100)
          : 0,
        effectiveDivertedKg: current.effectiveDivertedKg + effectiveDivertedKg,
        reclassifiedToLandfillKg: combinedReclassified,
        containerCount: current.containerCount + record.containerCount,
      });
    }

    return Array.from(byType.values()).sort((a, b) => b.grossWeightKg - a.grossWeightKg);
  }

  /**
   * Computes the audit for an event. The result is derived fresh every call, so
   * adding a late-arriving skip weight simply changes the answer.
   */
  public computeAudit(input: AuditInput): WasteAudit {
    if (!Number.isInteger(input.attendance) || input.attendance < 0) {
      throw new Error("Attendance must be a non-negative whole number.");
    }

    const existing = this.audits.get(input.eventId);
    if (existing?.finalized) {
      return existing;
    }

    const streams = this.buildStreamBreakdown(input.eventId);
    const totalWasteKg = this.round3(
      streams.reduce((sum, stream) => sum + stream.grossWeightKg, 0),
    );
    const divertedKg = this.round3(
      streams.reduce((sum, stream) => sum + stream.effectiveDivertedKg, 0),
    );
    const landfillKg = this.round3(totalWasteKg - divertedKg);

    const naiveDivertedKg = streams
      .filter((stream) => DIVERTED_STREAMS.includes(stream.streamType))
      .reduce((sum, stream) => sum + stream.grossWeightKg, 0);

    const diversionRate = totalWasteKg === 0 ? 0 : this.round3(divertedKg / totalWasteKg);
    const naiveDiversionRate = totalWasteKg === 0 ? 0 : this.round3(naiveDivertedKg / totalWasteKg);

    // Normalising by attendance is what makes a 2000-person fest comparable to
    // a 30-person workshop. Without it the fest always looks like the villain.
    const intensityKgPerAttendee =
      input.attendance === 0 ? 0 : this.round3(totalWasteKg / input.attendance);

    const audit: WasteAudit = {
      eventId: input.eventId,
      clubId: input.clubId,
      eventName: input.eventName,
      attendance: input.attendance,
      totalWasteKg,
      divertedKg,
      landfillKg,
      diversionRate,
      naiveDiversionRate,
      grade: this.gradeFor(diversionRate),
      intensityKgPerAttendee,
      streams,
      flags: this.deriveFlags(streams, totalWasteKg, intensityKgPerAttendee),
      finalized: false,
      finalizedAt: null,
    };

    this.audits.set(input.eventId, audit);
    return audit;
  }

  public gradeFor(diversionRate: number): DiversionGrade {
    const band = GRADE_BANDS.find((entry) => diversionRate >= entry.minRate);
    return band ? band.grade : "F";
  }

  /**
   * Flags are deliberately separate from the grade. A club can post a mediocre
   * overall rate for reasons outside its control, but a single badly
   * contaminated stream is a bin-signage problem someone can fix next week.
   */
  private deriveFlags(
    streams: StreamBreakdown[],
    totalWasteKg: number,
    intensityKgPerAttendee: number,
  ): AuditFlag[] {
    const flags: AuditFlag[] = [];

    if (streams.length === 0 || totalWasteKg === 0) {
      flags.push("NO_MEASUREMENT");
      return flags;
    }

    const criticallyContaminated = streams.some(
      (stream) =>
        DIVERTED_STREAMS.includes(stream.streamType) &&
        stream.contaminationPercent > CONTAMINATION_CRITICAL_PERCENT,
    );
    if (criticallyContaminated) {
      flags.push("CONTAMINATION_CRITICAL");
    }

    if (intensityKgPerAttendee > HIGH_INTENSITY_KG_PER_ATTENDEE) {
      flags.push("HIGH_INTENSITY");
    }

    return flags;
  }

  // ---------------------------------------------------------------------------
  // Finalisation
  // ---------------------------------------------------------------------------

  /**
   * Locks an audit. Sustainability reporting is submitted upward, so once a
   * figure has been reported the underlying weights must stop moving.
   */
  public finalizeAudit(eventId: string, finalizedAt: Date): WasteAudit {
    const audit = this.audits.get(eventId);
    if (!audit) {
      throw new Error(`No audit has been computed for event '${eventId}'.`);
    }
    if (audit.finalized) {
      throw new Error(`The audit for event '${eventId}' is already finalized.`);
    }
    if (audit.totalWasteKg === 0) {
      throw new Error("An audit with no measured waste cannot be finalized.");
    }

    const finalized: WasteAudit = { ...audit, finalized: true, finalizedAt };
    this.audits.set(eventId, finalized);
    return finalized;
  }

  public getAudit(eventId: string): WasteAudit | undefined {
    return this.audits.get(eventId);
  }

  private assertNotFinalized(eventId: string): void {
    if (this.audits.get(eventId)?.finalized) {
      throw new Error(
        `The audit for event '${eventId}' is finalized and its streams can no longer be edited.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Club trend
  // ---------------------------------------------------------------------------

  /**
   * Compares a club against itself over its last `limit` finalized audits.
   *
   * Only finalized audits are included: a draft is a work in progress and
   * letting it move the trend line would make the chart jump around while
   * someone is still typing weights in.
   */
  public buildClubTrend(clubId: string, limit = 6): ClubTrend {
    const finalized = Array.from(this.audits.values())
      .filter((audit) => audit.clubId === clubId && audit.finalized)
      .sort((a, b) => (a.finalizedAt?.getTime() ?? 0) - (b.finalizedAt?.getTime() ?? 0));

    const window = finalized.slice(-limit);

    const points: ClubTrendPoint[] = window.map((audit, index) => ({
      eventId: audit.eventId,
      eventName: audit.eventName,
      diversionRate: audit.diversionRate,
      grade: audit.grade,
      intensityKgPerAttendee: audit.intensityKgPerAttendee,
      deltaVsPrevious:
        index === 0 ? null : this.round3(audit.diversionRate - window[index - 1].diversionRate),
      finalizedAt: audit.finalizedAt,
    }));

    if (window.length === 0) {
      return {
        clubId,
        auditCount: 0,
        averageDiversionRate: 0,
        bestDiversionRate: 0,
        worstDiversionRate: 0,
        trendDirection: "FLAT",
        points,
      };
    }

    const rates = window.map((audit) => audit.diversionRate);
    const averageDiversionRate = this.round3(
      rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
    );

    return {
      clubId,
      auditCount: window.length,
      averageDiversionRate,
      bestDiversionRate: Math.max(...rates),
      worstDiversionRate: Math.min(...rates),
      trendDirection: this.trendDirection(rates),
      points,
    };
  }

  /**
   * Splits the window in half and compares the means. With fewer than two
   * audits there is nothing to compare, so the honest answer is FLAT rather
   * than an invented direction.
   */
  private trendDirection(rates: number[]): "IMPROVING" | "FLAT" | "DECLINING" {
    if (rates.length < 2) {
      return "FLAT";
    }

    const midpoint = Math.floor(rates.length / 2);
    const earlier = rates.slice(0, midpoint);
    const later = rates.slice(rates.length - midpoint);

    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    const shift = mean(later) - mean(earlier);
    if (Math.abs(shift) < 0.02) {
      return "FLAT";
    }
    return shift > 0 ? "IMPROVING" : "DECLINING";
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  /**
   * Plain-language summary for the sustainability office, showing the honest
   * rate alongside the naive one so the cost of contamination is legible.
   */
  public buildSummary(eventId: string): string {
    const audit = this.audits.get(eventId);
    if (!audit) {
      throw new Error(`No audit has been computed for event '${eventId}'.`);
    }

    if (audit.flags.includes("NO_MEASUREMENT")) {
      return `${audit.eventName}: no waste was weighed, so no diversion rate can be reported.`;
    }

    const lines: string[] = [
      `${audit.eventName} diverted ${audit.divertedKg} kg of ${audit.totalWasteKg} kg ` +
        `(${Math.round(audit.diversionRate * 100)}%, grade ${audit.grade}).`,
      `Waste intensity: ${audit.intensityKgPerAttendee} kg per attendee across ${audit.attendance} attendees.`,
    ];

    const contaminationCost = this.round3(audit.naiveDiversionRate - audit.diversionRate);
    if (contaminationCost > 0) {
      lines.push(
        `Contamination cost ${Math.round(contaminationCost * 100)} percentage points: ` +
          `the bins read ${Math.round(audit.naiveDiversionRate * 100)}% before it was applied.`,
      );
    }

    if (audit.flags.includes("CONTAMINATION_CRITICAL")) {
      const worst = audit.streams
        .filter((stream) => DIVERTED_STREAMS.includes(stream.streamType))
        .sort((a, b) => b.contaminationPercent - a.contaminationPercent)[0];
      lines.push(
        `Action: the ${worst.streamType} stream was ${worst.contaminationPercent}% contaminated. ` +
          `That is a bin placement or signage problem, not a volume problem.`,
      );
    }

    return lines.join(" ");
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}

export const eventWasteDiversionService = new EventWasteDiversionService();
