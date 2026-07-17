import { comments } from "./comments.js";
import { createComment, getIssue, isExpectedRepository } from "./helpers.js";
import { readMetadata, setAssignmentMetadata, updateIssueMetadata } from "./metadata.js";
import { isMaintainerRole, resolveActorRole } from "./permissions.js";
import { isIgnoredBotUser } from "./utils.js";

export async function processManualAssignment({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "issues" || context.payload.action !== "assigned") return;
  if (context.payload.issue?.pull_request) return;
  if (isIgnoredBotUser(context.payload.sender)) return;
  const assigner = context.payload.sender?.login;
  const assignerRole = await resolveActorRole(github, context, core, assigner);
  if (!isMaintainerRole(assignerRole)) return;

  const issueNumber = context.payload.issue.number;
  const assignedUser = context.payload.assignee?.login;
  if (!assignedUser) return;

  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;

  const metadata = readMetadata(issue.body);
  if (metadata.welcomeSource === "claim") return;

  await updateIssueMetadata(github, context, core, issue, (draft) =>
    setAssignmentMetadata(draft, "manual"),
  );
  await createComment(
    github,
    context,
    core,
    issueNumber,
    comments.manualAssignmentWelcome({ assignee: assignedUser, issueNumber }),
  );
}
