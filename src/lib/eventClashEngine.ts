/**
 * Event Clash Calculation Engine & Dependency Graph Visualizer Model
 * Issue #4140
 * Computes demographic tag Jaccard similarity, historical RSVP overlap,
 * temporal proximity decay, and force-directed graph node positioning.
 */

import {
  ScheduledEventSummary,
  AudienceOverlapMetric,
  ClashSeverity,
  ClashGraphNode,
  ClashGraphEdge,
  RescheduleAlternativeSlot,
  EventClashAnalysisResult,
  EventClashInput,
} from '../types/eventClashGraph';

/**
 * Calculates Jaccard similarity between two arrays of demographic tags.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function calculateTagJaccardSimilarity(
  tagsA: string[],
  tagsB: string[]
): { similarity: number; sharedTags: string[] } {
  const setA = new Set(tagsA.map((t) => t.trim().toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.trim().toLowerCase()));

  if (setA.size === 0 && setB.size === 0) {
    return { similarity: 0, sharedTags: [] };
  }

  const intersection: string[] = [];
  setA.forEach((tag) => {
    if (setB.has(tag)) {
      intersection.push(tag);
    }
  });

  const unionSize = new Set([...setA, ...setB]).size;
  const similarity = unionSize > 0 ? intersection.length / unionSize : 0;

  return {
    similarity: Math.round(similarity * 100) / 100,
    sharedTags: intersection,
  };
}

/**
 * Computes temporal proximity and overlap factor between two event time spans.
 * Checks within +/- 4 hour window (240 minutes).
 */
export function calculateTemporalProximity(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): { overlapMinutes: number; proximityFactor: number } {
  const sA = startA.getTime();
  const eA = endA.getTime();
  const sB = startB.getTime();
  const eB = endB.getTime();

  // Overlap span
  const overlapStart = Math.max(sA, sB);
  const overlapEnd = Math.min(eA, eB);
  const overlapMillis = Math.max(0, overlapEnd - overlapStart);
  const overlapMinutes = Math.round(overlapMillis / 60000);

  if (overlapMinutes > 0) {
    // Direct overlap: proximity factor between 0.85 and 1.0 based on duration percentage
    const minDur = Math.min(eA - sA, eB - sB);
    const frac = minDur > 0 ? overlapMillis / minDur : 1.0;
    return {
      overlapMinutes,
      proximityFactor: Math.min(1.0, 0.85 + frac * 0.15),
    };
  }

  // Non-overlapping gap
  const gapMillis = sB > eA ? sB - eA : sA - eB;
  const gapMinutes = Math.round(gapMillis / 60000);

  // If outside 4-hour window (240 min), proximity decay approaches 0
  if (gapMinutes >= 240) {
    return { overlapMinutes: 0, proximityFactor: 0 };
  }

  // Linear decay within 4 hours
  const proximityFactor = Math.max(0, (240 - gapMinutes) / 240) * 0.75;
  return {
    overlapMinutes: 0,
    proximityFactor: Math.round(proximityFactor * 100) / 100,
  };
}

/**
 * Computes composite clash severity index (0 - 100)
 * Weighted by:
 * - 40% Historical RSVP co-attendance overlap
 * - 35% Demographic / Interest Tag Jaccard similarity
 * - 25% Time Proximity / Concurrent overlap
 */
export function computeAudienceClashMetric(
  proposed: ScheduledEventSummary,
  competing: ScheduledEventSummary,
  historicalRsvpOverlapPct = 45
): AudienceOverlapMetric {
  const { similarity: tagSim, sharedTags } = calculateTagJaccardSimilarity(
    proposed.tags,
    competing.tags
  );

  const startP = new Date(proposed.start_time);
  const endP = new Date(proposed.end_time);
  const startC = new Date(competing.start_time);
  const endC = new Date(competing.end_time);

  const { overlapMinutes, proximityFactor } = calculateTemporalProximity(
    startP,
    endP,
    startC,
    endC
  );

  // If time proximity is 0 (outside 4 hours), clash score is 0
  if (proximityFactor <= 0) {
    return {
      shared_tag_count: sharedTags.length,
      tag_jaccard_similarity: tagSim,
      historical_rsvp_overlap_percentage: historicalRsvpOverlapPct,
      temporal_overlap_minutes: 0,
      time_proximity_factor: 0,
      composite_clash_score: 0,
      clash_severity: 'none',
      cannibalization_risk_summary: 'No schedule conflict (outside 4-hour window).',
    };
  }

  // Composite calculation
  const rsvpWeight = (historicalRsvpOverlapPct / 100) * 45;
  const tagWeight = tagSim * 35;
  const timeWeight = proximityFactor * 20;

  const rawScore = (rsvpWeight + tagWeight + timeWeight) * proximityFactor;
  const compositeScore = Math.min(100, Math.round(rawScore * 10) / 10);

  let severity: ClashSeverity = 'none';
  let summary = 'Minimal demographic overlap.';

  if (compositeScore >= 70) {
    severity = 'critical';
    summary = `Massive Demographic Clash! ~${Math.round(
      historicalRsvpOverlapPct
    )}% audience cannibalization and shared interest in [${sharedTags.join(
      ', '
    )}]. Reschedule strongly advised.`;
  } else if (compositeScore >= 48) {
    severity = 'high';
    summary = `Significant audience cannibalization risk with ${competing.club_name}. Concurrent scheduling will split student attendance.`;
  } else if (compositeScore >= 25) {
    severity = 'medium';
    summary = `Moderate interest overlap in [${sharedTags.join(', ')}].`;
  } else if (compositeScore >= 10) {
    severity = 'low';
    summary = 'Low overlap risk.';
  }

  return {
    shared_tag_count: sharedTags.length,
    tag_jaccard_similarity: tagSim,
    historical_rsvp_overlap_percentage: historicalRsvpOverlapPct,
    temporal_overlap_minutes: overlapMinutes,
    time_proximity_factor: proximityFactor,
    composite_clash_score: compositeScore,
    clash_severity: severity,
    cannibalization_risk_summary: summary,
  };
}

/**
 * Searches alternative time windows across +/- 3 days and earlier/later hours
 * to identify optimal clash-free schedule slots.
 */
export function generateRescheduleRecommendations(
  proposed: ScheduledEventSummary,
  allCompetingEvents: ScheduledEventSummary[],
  historicalOverlapMap: Record<string, number> = {}
): RescheduleAlternativeSlot[] {
  const durationMillis =
    new Date(proposed.end_time).getTime() - new Date(proposed.start_time).getTime();
  const baseStart = new Date(proposed.start_time);

  const candidates: { dayOffset: number; hourOffset: number; label: string }[] = [
    { dayOffset: 0, hourOffset: -3, label: '3 hours earlier today' },
    { dayOffset: 0, hourOffset: 3, label: '3 hours later today' },
    { dayOffset: 1, hourOffset: 0, label: 'Same time tomorrow' },
    { dayOffset: 1, hourOffset: 2, label: 'Tomorrow evening (+2h)' },
    { dayOffset: 2, hourOffset: 0, label: 'In 2 days (same time)' },
    { dayOffset: 3, hourOffset: 0, label: 'In 3 days' },
  ];

  const results: RescheduleAlternativeSlot[] = [];

  for (const cand of candidates) {
    const candStart = new Date(baseStart.getTime());
    candStart.setDate(candStart.getDate() + cand.dayOffset);
    candStart.setHours(candStart.getHours() + cand.hourOffset);

    const candEnd = new Date(candStart.getTime() + durationMillis);

    const testProposed: ScheduledEventSummary = {
      ...proposed,
      start_time: candStart.toISOString(),
      end_time: candEnd.toISOString(),
    };

    let maxClash = 0;
    let conflictCount = 0;

    for (const comp of allCompetingEvents) {
      const hist = historicalOverlapMap[comp.club_id] ?? 40;
      const metric = computeAudienceClashMetric(testProposed, comp, hist);
      if (metric.composite_clash_score > 20) {
        conflictCount++;
      }
      if (metric.composite_clash_score > maxClash) {
        maxClash = metric.composite_clash_score;
      }
    }

    results.push({
      start_time: candStart.toISOString(),
      end_time: candEnd.toISOString(),
      day_offset: cand.dayOffset,
      hour_offset: cand.hourOffset,
      projected_clash_score: maxClash,
      conflicting_events_count: conflictCount,
      recommendation_reason:
        maxClash < 20
          ? `Zero major clashes (${cand.label}). Maximizes attendance.`
          : `Reduced clash index to ${maxClash} (${cand.label}).`,
      is_optimal: false,
    });
  }

  // Pick the lowest clash slot as optimal
  results.sort((a, b) => a.projected_clash_score - b.projected_clash_score);
  if (results.length > 0) {
    results[0].is_optimal = true;
  }

  return results;
}

/**
 * Positions graph nodes in a force/radial layout for 2D Canvas / SVG visualization.
 */
export function layoutClashGraphNodes(
  proposed: ScheduledEventSummary,
  competingList: ScheduledEventSummary[],
  edges: ClashGraphEdge[],
  canvasWidth = 600,
  canvasHeight = 400
): { nodes: ClashGraphNode[]; edges: ClashGraphEdge[] } {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Center node: The proposed event
  const proposedNode: ClashGraphNode = {
    id: proposed.id,
    title: proposed.title,
    club_name: proposed.club_name,
    club_id: proposed.club_id,
    start_time: proposed.start_time,
    end_time: proposed.end_time,
    tags: proposed.tags,
    attendance: proposed.expected_attendance,
    is_proposed: true,
    x: centerX,
    y: centerY,
    radius: 32,
  };

  const nodes: ClashGraphNode[] = [proposedNode];
  const count = competingList.length;

  // Position competing events around the center node radially
  competingList.forEach((comp, idx) => {
    const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;

    // Radius distance reflects clash severity: closer = higher clash
    const edge = edges.find(
      (e) =>
        (e.source === proposed.id && e.target === comp.id) ||
        (e.target === proposed.id && e.source === comp.id)
    );

    const clash = edge ? edge.clash_score : 10;
    // High clash pulls node closer (110px), low clash pushes node farther (190px)
    const dist = 195 - (clash / 100) * 85;

    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;

    nodes.push({
      id: comp.id,
      title: comp.title,
      club_name: comp.club_name,
      club_id: comp.club_id,
      start_time: comp.start_time,
      end_time: comp.end_time,
      tags: comp.tags,
      attendance: comp.expected_attendance,
      is_proposed: false,
      x: Math.round(x),
      y: Math.round(y),
      radius: 24,
    });
  });

  return { nodes, edges };
}

/**
 * Full Event Clash Analysis Coordinator
 */
export function analyzeEventClashes(
  input: EventClashInput,
  competingEvents: ScheduledEventSummary[],
  historicalOverlapMap: Record<string, number> = {}
): EventClashAnalysisResult {
  const proposedSummary: ScheduledEventSummary = {
    id: 'proposed-event-target',
    title: input.title,
    club_id: input.club_id,
    club_name: input.club_name,
    start_time: input.start_time,
    end_time: input.end_time,
    tags: input.tags,
    expected_attendance: input.expected_attendance || 120,
    location: input.location,
    is_target_proposed: true,
  };

  const rawEdges: ClashGraphEdge[] = [];
  const breakdowns: {
    event_id: string;
    event_title: string;
    club_name: string;
    metric: AudienceOverlapMetric;
  }[] = [];

  let maxScore = 0;

  for (const comp of competingEvents) {
    const histOverlap = historicalOverlapMap[comp.club_id] ?? 50;
    const metric = computeAudienceClashMetric(proposedSummary, comp, histOverlap);

    if (metric.composite_clash_score > maxScore) {
      maxScore = metric.composite_clash_score;
    }

    let strokeWidth = 1.5;
    let strokeColor = '#64748b';
    let isCritical = false;

    if (metric.clash_severity === 'critical') {
      strokeWidth = 5.5;
      strokeColor = '#ef4444'; // Glowing thick red
      isCritical = true;
    } else if (metric.clash_severity === 'high') {
      strokeWidth = 4.0;
      strokeColor = '#f97316'; // Orange
    } else if (metric.clash_severity === 'medium') {
      strokeWidth = 2.5;
      strokeColor = '#eab308'; // Yellow
    } else if (metric.clash_severity === 'low') {
      strokeWidth = 1.8;
      strokeColor = '#38bdf8'; // Sky blue
    }

    rawEdges.push({
      id: `edge-${proposedSummary.id}-${comp.id}`,
      source: proposedSummary.id,
      target: comp.id,
      clash_score: metric.composite_clash_score,
      severity: metric.clash_severity,
      overlap_metric: metric,
      stroke_width: strokeWidth,
      color: strokeColor,
      is_critical_clash: isCritical,
    });

    breakdowns.push({
      event_id: comp.id,
      event_title: comp.title,
      club_name: comp.club_name,
      metric,
    });
  }

  const { nodes, edges } = layoutClashGraphNodes(
    proposedSummary,
    competingEvents,
    rawEdges
  );

  const rescheduleRecommendations = generateRescheduleRecommendations(
    proposedSummary,
    competingEvents,
    historicalOverlapMap
  );

  let overallSeverity: ClashSeverity = 'none';
  if (maxScore >= 70) overallSeverity = 'critical';
  else if (maxScore >= 48) overallSeverity = 'high';
  else if (maxScore >= 25) overallSeverity = 'medium';
  else if (maxScore >= 10) overallSeverity = 'low';

  let verdictHeadline = 'Optimal Schedule Slot!';
  let verdictAdvice = 'Minimal demographic or timeline clashes detected with other campus events.';
  let verdictStatus: 'clear' | 'minor_warning' | 'reschedule_recommended' | 'severe_clash_blocker' =
    'clear';

  if (overallSeverity === 'critical') {
    verdictHeadline = 'Massive Demographic Clash - Reschedule Strongly Recommended!';
    verdictAdvice =
      'High co-attendance overlap with concurrent events will severely split attendance for both clubs.';
    verdictStatus = 'severe_clash_blocker';
  } else if (overallSeverity === 'high') {
    verdictHeadline = 'High Audience Overlap Detected';
    verdictAdvice = 'Consider shifting by 2-3 hours to capture peak student turnout.';
    verdictStatus = 'reschedule_recommended';
  } else if (overallSeverity === 'medium') {
    verdictHeadline = 'Moderate Category Overlap';
    verdictAdvice = 'Minor overlap detected. Coordinate with organizers if desired.';
    verdictStatus = 'minor_warning';
  }

  return {
    proposed_event: proposedSummary,
    concurrent_events_analyzed: competingEvents.length,
    highest_clash_score: maxScore,
    overall_clash_severity: overallSeverity,
    nodes,
    edges,
    reschedule_recommendations: rescheduleRecommendations,
    audience_cannibalization_breakdown: breakdowns,
    verdict: {
      status: verdictStatus,
      headline: verdictHeadline,
      advice: verdictAdvice,
    },
  };
}
