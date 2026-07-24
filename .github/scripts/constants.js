export const AUTOMATION = Object.freeze({
  id: "campusconnect",
  metadataStart: "<!-- cc:metadata:start -->",
  metadataEnd: "<!-- cc:metadata:end -->",
  markerPrefix: "cc",
  claimWelcomeMarker: "cc:claim-welcome",
  assignmentWelcomeMarker: "cc:manual-assignment-welcome",
  prChecklistMarker: "cc:pr-checklist",
  mergedMarker: "cc:pr-merged",
  firstWelcomeMarker: "cc:first-contributor-welcome",
  firstIssueWelcomeMarker: "cc:first-issue-welcome",
  guidanceMarker: "cc:claim-guidance",
  overrideMarker: "cc:maintainer-override",
});

export const COMMANDS = Object.freeze({
  claim: "/claim",
  unclaim: "/unclaim",
});

export const LIMITS = Object.freeze({
  maxActiveAssignedIssues: 10,
  guidanceCooldownHours: 12,
});

export const IGNORE_BOTS = Object.freeze([
  "github-actions[bot]",
  "dependabot[bot]",
  "renovate[bot]",
]);

export const MAINTAINER_ASSOCIATIONS = Object.freeze(["OWNER", "MEMBER", "COLLABORATOR"]);

export const ISSUE_EVENTS = Object.freeze({
  assigned: "assigned",
  unassigned: "unassigned",
  reopened: "reopened",
  closed: "closed",
  transferred: "transferred",
});

export const PR_EVENTS = Object.freeze({
  opened: "opened",
  edited: "edited",
  synchronize: "synchronize",
  reopened: "reopened",
  readyForReview: "ready_for_review",
  closed: "closed",
});

export const EXPECTED_REPOSITORY =
  process.env.AUTOMATION_REPOSITORY || process.env.GITHUB_REPOSITORY || "";
