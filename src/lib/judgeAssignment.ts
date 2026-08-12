/**
 * Hackathon Judging Assignment Engine (#3135).
 *
 * Produces a balanced, conflict-free mapping of judges to projects. The engine
 * is deterministic by design: the same inputs must always yield the same
 * assignment matrix so that a disputed result can be reproduced during an
 * appeal. Nothing in the allocation path may depend on Math.random() or on
 * object key ordering.
 *
 * Pure module - no React, no Supabase - so the allocation can be unit tested
 * exhaustively and replayed offline.
 */

export type ConflictReason = "SAME_TEAM" | "SAME_CLUB" | "MENTOR" | "SELF_DECLARED";

export type CoverageFailureReason =
  "NO_ELIGIBLE_JUDGES" | "INSUFFICIENT_JUDGE_POOL" | "SLOT_CAPACITY_EXHAUSTED";

export interface Judge {
  id: string;
  name: string;
  /** Topics this judge can credibly assess. */
  expertiseTags: string[];
  /** Clubs the judge is affiliated with, used for SAME_CLUB detection. */
  clubIds: string[];
  /** Teams the judge mentors, used for MENTOR detection. */
  mentoredProjectIds?: string[];
  /** Projects the judge has manually recused themselves from. */
  recusedProjectIds?: string[];
  /**
   * Slots the judge is available for. An empty or omitted list means the judge
   * is available for every slot.
   */
  availableSlotIds?: string[];
}

export interface Project {
  id: string;
  name: string;
  /** Judge ids appearing here are on the team and can never judge it. */
  teamMemberIds: string[];
  /** Clubs the team is entered under. */
  clubIds: string[];
  topicTags: string[];
  slotId: string;
}

export interface Conflict {
  judgeId: string;
  projectId: string;
  reason: ConflictReason;
  detail: string;
}

export interface Assignment {
  projectId: string;
  judgeId: string;
  slotId: string;
  /** Number of topic tags shared between judge and project. */
  expertiseOverlap: number;
}

export interface CoverageGap {
  projectId: string;
  assignedCount: number;
  requiredCount: number;
  reason: CoverageFailureReason;
  detail: string;
}

export interface WorkloadSummary {
  min: number;
  max: number;
  mean: number;
  /** max - min across judges who were eligible for at least one project. */
  spread: number;
  perJudge: Record<string, number>;
}

export interface AssignmentOptions {
  judgesPerProject?: number;
  /** Hard ceiling on assignments per judge, applied on top of balancing. */
  maxAssignmentsPerJudge?: number;
}

export interface AssignmentResult {
  assignments: Assignment[];
  conflicts: Conflict[];
  coverageGaps: CoverageGap[];
  workload: WorkloadSummary;
  isFullyCovered: boolean;
}

export const DEFAULT_JUDGES_PER_PROJECT = 2;

/**
 * Every reason this judge may not assess this project. Returns all applicable
 * reasons rather than short-circuiting, because organisers need the full
 * picture when defending an allocation.
 */
export function detectConflicts(judge: Judge, project: Project): Conflict[] {
  const conflicts: Conflict[] = [];

  if (project.teamMemberIds.includes(judge.id)) {
    conflicts.push({
      judgeId: judge.id,
      projectId: project.id,
      reason: "SAME_TEAM",
      detail: `${judge.name} is listed on the roster for ${project.name}.`,
    });
  }

  const sharedClubs = judge.clubIds.filter((clubId) => project.clubIds.includes(clubId));
  if (sharedClubs.length > 0) {
    conflicts.push({
      judgeId: judge.id,
      projectId: project.id,
      reason: "SAME_CLUB",
      detail: `${judge.name} shares club affiliation (${sharedClubs.join(", ")}) with ${project.name}.`,
    });
  }

  if (judge.mentoredProjectIds?.includes(project.id)) {
    conflicts.push({
      judgeId: judge.id,
      projectId: project.id,
      reason: "MENTOR",
      detail: `${judge.name} mentors ${project.name}.`,
    });
  }

  if (judge.recusedProjectIds?.includes(project.id)) {
    conflicts.push({
      judgeId: judge.id,
      projectId: project.id,
      reason: "SELF_DECLARED",
      detail: `${judge.name} has recused themselves from ${project.name}.`,
    });
  }

  return conflicts;
}

/** A judge is eligible only when no conflict of any kind applies. */
export function isEligible(judge: Judge, project: Project): boolean {
  return detectConflicts(judge, project).length === 0;
}

/** Whether the judge has declared themselves available for the project's slot. */
export function isAvailableForSlot(judge: Judge, slotId: string): boolean {
  if (!judge.availableSlotIds || judge.availableSlotIds.length === 0) return true;
  return judge.availableSlotIds.includes(slotId);
}

/** Count of shared topic tags, compared case-insensitively. */
export function expertiseOverlap(judge: Judge, project: Project): number {
  const judgeTags = new Set(judge.expertiseTags.map((tag) => tag.toLowerCase().trim()));
  return project.topicTags.filter((tag) => judgeTags.has(tag.toLowerCase().trim())).length;
}

/**
 * Every conflict across the whole bracket, sorted deterministically. This is
 * the audit artefact organisers publish alongside the results.
 */
export function collectAllConflicts(judges: Judge[], projects: Project[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const project of projects) {
    for (const judge of judges) {
      conflicts.push(...detectConflicts(judge, project));
    }
  }

  return conflicts.sort(
    (a, b) =>
      a.projectId.localeCompare(b.projectId) ||
      a.judgeId.localeCompare(b.judgeId) ||
      a.reason.localeCompare(b.reason),
  );
}

/**
 * Judges who could in principle assess each project, ignoring slot occupancy
 * but honouring conflicts and declared availability. Judge ids are sorted so
 * downstream ordering is stable.
 */
export function buildEligibilityMatrix(
  judges: Judge[],
  projects: Project[],
): Map<string, string[]> {
  const matrix = new Map<string, string[]>();

  for (const project of projects) {
    const eligible = judges
      .filter((judge) => isEligible(judge, project) && isAvailableForSlot(judge, project.slotId))
      .map((judge) => judge.id)
      .sort((a, b) => a.localeCompare(b));

    matrix.set(project.id, eligible);
  }

  return matrix;
}

/**
 * Workload statistics across judges who were eligible for at least one
 * project. Judges nobody could use are excluded, otherwise a judge conflicted
 * out of the entire bracket would make every allocation look unbalanced.
 */
export function summariseWorkload(
  judges: Judge[],
  assignments: Assignment[],
  eligibility: Map<string, string[]>,
): WorkloadSummary {
  const perJudge: Record<string, number> = {};
  for (const judge of judges) {
    perJudge[judge.id] = 0;
  }
  for (const assignment of assignments) {
    perJudge[assignment.judgeId] = (perJudge[assignment.judgeId] ?? 0) + 1;
  }

  const usableJudgeIds = new Set<string>();
  for (const eligibleIds of eligibility.values()) {
    for (const id of eligibleIds) usableJudgeIds.add(id);
  }

  const counts = judges
    .filter((judge) => usableJudgeIds.has(judge.id))
    .map((judge) => perJudge[judge.id] ?? 0);

  if (counts.length === 0) {
    return { min: 0, max: 0, mean: 0, spread: 0, perJudge };
  }

  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const mean = counts.reduce((sum, n) => sum + n, 0) / counts.length;

  return {
    min,
    max,
    mean: Math.round(mean * 1000) / 1000,
    spread: max - min,
    perJudge,
  };
}

/**
 * Allocates judges to projects.
 *
 * Projects are processed scarcest-first: a project with only two eligible
 * judges must claim them before a project with twelve options takes one away.
 * Within a project, candidates are ranked by current workload (to keep the
 * allocation balanced), then by expertise overlap, then by id as a stable
 * tie-break. Expertise never overrides a conflict, and a judge is never given
 * two projects in the same slot.
 */
export function assignJudges(
  judges: Judge[],
  projects: Project[],
  options: AssignmentOptions = {},
): AssignmentResult {
  const judgesPerProject = options.judgesPerProject ?? DEFAULT_JUDGES_PER_PROJECT;
  const maxPerJudge = options.maxAssignmentsPerJudge ?? Number.POSITIVE_INFINITY;

  const judgeById = new Map(judges.map((judge) => [judge.id, judge]));
  const eligibility = buildEligibilityMatrix(judges, projects);

  const load = new Map<string, number>(judges.map((judge) => [judge.id, 0]));
  const occupiedSlots = new Map<string, Set<string>>(
    judges.map((judge) => [judge.id, new Set<string>()]),
  );

  const assignments: Assignment[] = [];
  const coverageGaps: CoverageGap[] = [];

  // Scarcest project first, id as a stable tie-break.
  const ordered = [...projects].sort((a, b) => {
    const aCount = eligibility.get(a.id)?.length ?? 0;
    const bCount = eligibility.get(b.id)?.length ?? 0;
    return aCount - bCount || a.id.localeCompare(b.id);
  });

  for (const project of ordered) {
    const eligibleIds = eligibility.get(project.id) ?? [];

    const candidates = eligibleIds.filter((judgeId) => {
      const slots = occupiedSlots.get(judgeId);
      const current = load.get(judgeId) ?? 0;
      return !slots?.has(project.slotId) && current < maxPerJudge;
    });

    candidates.sort((a, b) => {
      const loadDelta = (load.get(a) ?? 0) - (load.get(b) ?? 0);
      if (loadDelta !== 0) return loadDelta;

      const judgeA = judgeById.get(a)!;
      const judgeB = judgeById.get(b)!;
      const overlapDelta = expertiseOverlap(judgeB, project) - expertiseOverlap(judgeA, project);
      if (overlapDelta !== 0) return overlapDelta;

      return a.localeCompare(b);
    });

    const chosen = candidates.slice(0, judgesPerProject);

    for (const judgeId of chosen) {
      const judge = judgeById.get(judgeId)!;
      assignments.push({
        projectId: project.id,
        judgeId,
        slotId: project.slotId,
        expertiseOverlap: expertiseOverlap(judge, project),
      });
      load.set(judgeId, (load.get(judgeId) ?? 0) + 1);
      occupiedSlots.get(judgeId)!.add(project.slotId);
    }

    if (chosen.length < judgesPerProject) {
      coverageGaps.push({
        projectId: project.id,
        assignedCount: chosen.length,
        requiredCount: judgesPerProject,
        reason: resolveCoverageFailure(eligibleIds.length, candidates.length, judgesPerProject),
        detail: buildCoverageDetail(project, eligibleIds.length, candidates.length, chosen.length),
      });
    }
  }

  assignments.sort(
    (a, b) => a.projectId.localeCompare(b.projectId) || a.judgeId.localeCompare(b.judgeId),
  );
  coverageGaps.sort((a, b) => a.projectId.localeCompare(b.projectId));

  return {
    assignments,
    conflicts: collectAllConflicts(judges, projects),
    coverageGaps,
    workload: summariseWorkload(judges, assignments, eligibility),
    isFullyCovered: coverageGaps.length === 0,
  };
}

function resolveCoverageFailure(
  eligibleCount: number,
  availableCount: number,
  required: number,
): CoverageFailureReason {
  if (eligibleCount === 0) return "NO_ELIGIBLE_JUDGES";
  if (availableCount < eligibleCount) return "SLOT_CAPACITY_EXHAUSTED";
  if (eligibleCount < required) return "INSUFFICIENT_JUDGE_POOL";
  return "INSUFFICIENT_JUDGE_POOL";
}

function buildCoverageDetail(
  project: Project,
  eligibleCount: number,
  availableCount: number,
  assignedCount: number,
): string {
  if (eligibleCount === 0) {
    return `Every judge is conflicted out of ${project.name}; recruit an external judge.`;
  }
  if (availableCount < eligibleCount) {
    return `${project.name} has ${eligibleCount} eligible judges but only ${availableCount} are free in slot ${project.slotId}.`;
  }
  return `${project.name} has only ${eligibleCount} eligible judges and received ${assignedCount}.`;
}

/**
 * Verifies an assignment matrix against the constraints. Used as a guard
 * before results are published, and as the definition of a valid allocation.
 */
export function validateAssignments(
  judges: Judge[],
  projects: Project[],
  assignments: Assignment[],
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const judgeById = new Map(judges.map((judge) => [judge.id, judge]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const seenSlots = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    const judge = judgeById.get(assignment.judgeId);
    const project = projectById.get(assignment.projectId);

    if (!judge || !project) {
      violations.push(
        `Assignment references unknown judge or project: ${JSON.stringify(assignment)}`,
      );
      continue;
    }

    const conflicts = detectConflicts(judge, project);
    if (conflicts.length > 0) {
      violations.push(
        `${judge.name} is conflicted on ${project.name} (${conflicts.map((c) => c.reason).join(", ")}).`,
      );
    }

    if (!isAvailableForSlot(judge, project.slotId)) {
      violations.push(`${judge.name} is not available in slot ${project.slotId}.`);
    }

    const slots = seenSlots.get(judge.id) ?? new Set<string>();
    if (slots.has(project.slotId)) {
      violations.push(`${judge.name} is double-booked in slot ${project.slotId}.`);
    }
    slots.add(project.slotId);
    seenSlots.set(judge.id, slots);
  }

  return { valid: violations.length === 0, violations };
}
