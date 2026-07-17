import { LIMITS } from "./constants.js";
import { comments } from "./comments.js";
import { createComment, findCommentByMarker, getIssue, isExpectedRepository } from "./helpers.js";
import { readMetadata, updateIssueMetadata } from "./metadata.js";
import { isNaturalLanguageClaim } from "./regex.js";
import {
  hoursSince,
  isCommand,
  isIgnoredBotUser,
  markerForUserIssue,
  withMarker,
} from "./utils.js";
import { COMMANDS } from "./constants.js";

export async function processIssueCommentGuidance({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "issue_comment" || context.payload.action !== "created") return;
  if (context.payload.issue?.pull_request) return;

  const actor = context.payload.comment?.user?.login;
  const body = context.payload.comment?.body || "";
  if (isIgnoredBotUser(context.payload.comment?.user)) return;
  if (isCommand(body, COMMANDS.claim) || isCommand(body, COMMANDS.unclaim)) return;
  if (!isNaturalLanguageClaim(body)) return;

  const issueNumber = context.payload.issue.number;
  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;

  const currentAssignee = issue.assignees?.[0]?.login;
  if (currentAssignee === actor) return;

  const metadata = readMetadata(issue.body);
  const key = `${actor}:issue-${issueNumber}`;
  const lastSent = metadata.guidance?.[key];
  if (lastSent && hoursSince(lastSent) < LIMITS.guidanceCooldownHours) return;
  const marker = markerForUserIssue("cc:claim-guidance", actor, issueNumber);
  const existingGuidanceComment = await findCommentByMarker(
    github,
    context,
    core,
    issueNumber,
    marker,
  );
  if (existingGuidanceComment) return;

  await createComment(
    github,
    context,
    core,
    issueNumber,
    withMarker(marker, comments.naturalLanguageClaimGuidance({ user: actor })),
  );
  await updateIssueMetadata(github, context, core, issue, (draft) => {
    const guidance = draft.guidance || {};
    guidance[key] = new Date().toISOString();
    draft.guidance = guidance;
    return draft;
  });
}
