// src/hooks/useResponderCoverage.ts
// -----------------------------------------------------------------------------
// Issue #3754 — Dynamic Certified First-Aid Responder Coverage Planner
//
// Loads an event's risk assessment and responder roster, then runs the
// sweep-line coverage analysis over it.
//
// The analysis runs client-side because the safety officer adjusts duty blocks
// interactively — dragging a shift earlier should re-check coverage instantly,
// not after a round trip. The server owns the data and the authorisation: the
// RPC returns certifications only for responders actually rostered on this
// event, so an officer cannot read medical certifications at large.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  analyseCoverage,
  deriveRiskTier,
  type ActivityRisk,
  type CertificationLevel,
  type CoverageAnalysis,
  type EventRiskTier,
  type ResponderCertification,
  type ResponderDuty,
} from "@/lib/responderCoverage";

interface RawCertification {
  id: string;
  userId: string;
  level: CertificationLevel;
  issuingBody: string;
  issuedOn: string;
  expiresOn: string;
}

interface RosterRow {
  duty_id: string;
  responder_id: string;
  responder_name: string;
  starts_at: string;
  ends_at: string;
  station: string | null;
  status: string;
  certifications: RawCertification[] | null;
}

interface RiskAssessmentRow {
  event_id: string;
  expected_attendance: number;
  activity_risk: ActivityRisk;
  derived_tier: EventRiskTier;
  override_tier: EventRiskTier | null;
  override_reason: string | null;
  coverage_starts_at: string;
  coverage_ends_at: string;
}

export interface UseResponderCoverageResult {
  assessment: RiskAssessmentRow | null;
  /** The tier actually in force — the override when set, else the derived one. */
  effectiveTier: EventRiskTier | null;
  analysis: CoverageAnalysis | null;
  duties: ResponderDuty[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResponderCoverage(
  eventId: string | null | undefined,
): UseResponderCoverageResult {
  const [assessment, setAssessment] = useState<RiskAssessmentRow | null>(null);
  const [duties, setDuties] = useState<ResponderDuty[]>([]);
  const [certifications, setCertifications] = useState<ResponderCertification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoverage = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [assessmentResult, rosterResult] = await Promise.all([
        supabase
          .from("event_risk_assessments")
          .select(
            "event_id, expected_attendance, activity_risk, derived_tier, override_tier, override_reason, coverage_starts_at, coverage_ends_at",
          )
          .eq("event_id", eventId)
          .maybeSingle(),
        supabase.rpc("get_event_coverage_roster", { p_event_id: eventId }),
      ]);

      if (assessmentResult.error) throw assessmentResult.error;
      if (rosterResult.error) throw rosterResult.error;

      setAssessment((assessmentResult.data as RiskAssessmentRow) ?? null);

      const rows = (rosterResult.data ?? []) as RosterRow[];
      setDuties(
        rows.map((row) => ({
          id: row.duty_id,
          responderId: row.responder_id,
          responderName: row.responder_name,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          station: row.station,
        })),
      );

      // The same responder appears on every duty row they hold, so their
      // certifications arrive repeatedly. Deduplicate by id before analysing,
      // otherwise a responder working two blocks would look doubly certified.
      const certById = new Map<string, ResponderCertification>();
      for (const row of rows) {
        for (const raw of row.certifications ?? []) {
          certById.set(raw.id, {
            id: raw.id,
            userId: raw.userId,
            level: raw.level,
            issuingBody: raw.issuingBody,
            issuedOn: raw.issuedOn,
            expiresOn: raw.expiresOn,
          });
        }
      }
      setCertifications(Array.from(certById.values()));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load the responder coverage roster";
      setError(message);
      setAssessment(null);
      setDuties([]);
      setCertifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchCoverage();
  }, [fetchCoverage]);

  const effectiveTier = useMemo<EventRiskTier | null>(() => {
    if (!assessment) return null;
    if (assessment.override_tier) return assessment.override_tier;
    // Re-derive rather than trusting the stored column: attendance can be
    // edited elsewhere, and a stale derived_tier would understate the
    // requirement, which is the one direction that must never happen silently.
    return deriveRiskTier(assessment.expected_attendance, assessment.activity_risk);
  }, [assessment]);

  const analysis = useMemo<CoverageAnalysis | null>(() => {
    if (!assessment || !effectiveTier) return null;
    return analyseCoverage(
      duties,
      certifications,
      assessment.coverage_starts_at,
      assessment.coverage_ends_at,
      effectiveTier,
    );
  }, [assessment, effectiveTier, duties, certifications]);

  return {
    assessment,
    effectiveTier,
    analysis,
    duties,
    isLoading,
    error,
    refresh: fetchCoverage,
  };
}
