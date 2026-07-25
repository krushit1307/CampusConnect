import { AUTOMATION, COMMANDS, LIMITS } from "./constants.js";
import { comments } from "./comments.js";
import {
  createComment,
  findCommentByMarker,
  getIssue,
  isExpectedRepository,
  safeCall,
} from "./helpers.js";
import { readMetadata, updateIssueMetadata } from "./metadata.js";
import { isNaturalLanguageClaim } from "./regex.js";
import {
  hasMarker,
  hoursSince,
  isCommand,
  isIgnoredBotUser,
  markerForUserIssue,
  withMarker,
} from "./utils.js";

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

export async function processFirstIssueWelcome({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "issues" || context.payload.action !== "opened") return;

  const issue = context.payload.issue;
  if (!issue || issue.pull_request) return;
  if (isIgnoredBotUser(issue.user)) return;

  const authorAssociation = issue.author_association;
  const isFirstTimeAssoc = ["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"].includes(
    authorAssociation,
  );

  let isFirstIssue = isFirstTimeAssoc;
  if (!isFirstIssue) {
    const userIssues = await safeCall(
      core,
      "issues.listForRepo(for first issue check)",
      () =>
        github.paginate(github.rest.issues.listForRepo, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          creator: issue.user.login,
          state: "all",
        }),
      [],
    );
    const nonPrIssues = (userIssues || []).filter((item) => !item.pull_request);
    isFirstIssue = nonPrIssues.length <= 1;
  }

  if (!isFirstIssue) return;

  const existingComments = await safeCall(
    core,
    "issues.listComments(for first issue welcome check)",
    () =>
      github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.number,
        per_page: 100,
      }),
    [],
  );

  if (
    (existingComments || []).some((comment) =>
      hasMarker(comment.body, AUTOMATION.firstIssueWelcomeMarker),
    )
  ) {
    return;
  }

  await createComment(
    github,
    context,
    core,
    issue.number,
    comments.welcomeMessage({ user: issue.user.login }),
  );
}
