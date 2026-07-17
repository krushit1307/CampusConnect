import { TIMERS } from "./constants.js";
import { comments } from "./comments.js";
import {
  createComment,
  getIssue,
  listComments,
  listOpenAssignedIssues,
  removeAssignee,
} from "./helpers.js";
import { clearAssignmentMetadata, readMetadata, updateIssueMetadata } from "./metadata.js";
import { isActivitySignal } from "./regex.js";
import { hasMarker, hoursSince, nowIso } from "./utils.js";

function hasLinkedPrActivity(commentsList, assignee) {
  return commentsList.some((comment) => {
    if (comment.user?.login !== assignee) return false;
    return /#\d+|pull request|pr/i.test(comment.body || "");
  });
}

export async function processClaimExpiration({ github, context, core }) {
  const issues = await listOpenAssignedIssues(github, context, core);
  for (const issueSummary of issues) {
    const issue = await getIssue(github, context, core, issueSummary.number);
    if (!issue || issue.state !== "open" || issue.locked) continue;
    const assignee = issue.assignees?.[0]?.login;
    if (!assignee) continue;

    const metadata = readMetadata(issue.body);
    const issueComments = await listComments(github, context, core, issue.number);

    const lastSignal = issueComments
      .filter((c) => c.user?.login === assignee)
      .filter((c) => isActivitySignal(c.body) || hasLinkedPrActivity([c], assignee))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (lastSignal) {
      const signalTime = lastSignal.created_at;
      if (!metadata.lastActivityAt || new Date(signalTime) > new Date(metadata.lastActivityAt)) {
        await updateIssueMetadata(github, context, core, issue, (draft) => {
          draft.lastActivityAt = signalTime;
          draft.reminder12SentAt = null;
          draft.reminder18SentAt = null;
          return draft;
        });
      }
    }

    const freshIssue = await getIssue(github, context, core, issue.number);
    if (!freshIssue) continue;
    const freshMeta = readMetadata(freshIssue.body);
    const baseline = freshMeta.lastActivityAt || freshMeta.assignedAt || freshIssue.updated_at;
    const inactiveHours = hoursSince(baseline);

    if (inactiveHours >= TIMERS.expirationHours) {
      await removeAssignee(github, context, core, issue.number, assignee);
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.expiration24h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) =>
        clearAssignmentMetadata(draft),
      );
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder18Hours &&
      !freshMeta.reminder18SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "cc:reminder-18h"))
    ) {
      await createComment(github, context, core, issue.number, comments.reminder18h({ assignee }));
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder18SentAt = nowIso();
        return draft;
      });
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder12Hours &&
      !freshMeta.reminder12SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "cc:reminder-12h"))
    ) {
      await createComment(github, context, core, issue.number, comments.reminder12h({ assignee }));
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder12SentAt = nowIso();
        return draft;
      });
    }
  }
}
