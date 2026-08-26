import { AUTOMATION, MAINTAINER_ASSOCIATIONS } from "./constants.js";
import { safeCall } from "./helpers.js";

function hoursSince(dateString) {
  return (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60);
}

export async function processActivityReminder({ github, context, core }) {
  const { owner, repo } = context.repo;

  // 1. Fetch all open issues and PRs (GitHub issues API returns both)
  const openItems = await safeCall(
    core,
    "issues.listForRepo(open)",
    () =>
      github.paginate(github.rest.issues.listForRepo, {
        owner,
        repo,
        state: "open",
        per_page: 100,
      }),
    [],
  );

  for (const item of openItems) {
    const isPR = !!item.pull_request;
    const itemNumber = item.number;
    const createdAt = item.created_at;
    const elapsedHours = hoursSince(createdAt);

    // Fetch comments for this item
    const comments = await safeCall(
      core,
      "issues.listComments",
      () =>
        github.paginate(github.rest.issues.listComments, {
          owner,
          repo,
          issue_number: itemNumber,
          per_page: 100,
        }),
      [],
    );

    // Determine if any admin action/response has occurred
    const hasAdminComment = comments.some((comment) => {
      const isBot = comment.user?.type === "Bot";
      const isAdminAssociation = MAINTAINER_ASSOCIATIONS.includes(comment.author_association);
      const isOwner = comment.user?.login === owner;
      return !isBot && (isAdminAssociation || isOwner);
    });

    if (isPR) {
      // --- Pull Request Activity Logic ---
      const reviewsResponse = await safeCall(
        core,
        "pulls.listReviews",
        () =>
          github.rest.pulls.listReviews({
            owner,
            repo,
            pull_number: itemNumber,
            per_page: 100,
          }),
        { data: [] },
      );
      const reviewsList = reviewsResponse?.data || [];
      const hasAdminReview = reviewsList.some((review) => {
        const isBot = review.user?.type === "Bot";
        const isOwner = review.user?.login === owner;
        // GitHub pulls API reviews don't always have author_association, so fallback to checking owner
        return !isBot && isOwner;
      });

      const hasAdminAction = hasAdminComment || hasAdminReview;

      if (!hasAdminAction) {
        const isEcsocPr = item.labels.some((l) => l.name === "ECSoC26");

        // First Response Warning (within 24 hours / 48 hours for points)
        if (isEcsocPr && elapsedHours >= 18 && elapsedHours < 48) {
          const hasResponseWarning = comments.some((c) =>
            c.body.includes("cc:pr-first-response-warning"),
          );
          if (!hasResponseWarning) {
            console.log(`PR #${itemNumber}: Sending First Response warning.`);
            await safeCall(core, "issues.createComment", () =>
              github.rest.issues.createComment({
                owner,
                repo,
                issue_number: itemNumber,
                body: `<!-- cc:pr-first-response-warning -->\n@${owner} ⚠️ **PR First Response Warning:** This ECSoC26 PR has been open for ${Math.round(elapsedHours)} hours without an admin response. Please review or comment on it soon to secure maximum scoring points! 🚀`,
              }),
            );
          }
        }

        // Inaction warning (PR open > 4 days/96 hours, penalty at 5 days/120 hours)
        if (elapsedHours >= 96) {
          const hasInactionWarning = comments.some((c) =>
            c.body.includes("cc:pr-inaction-warning"),
          );
          if (!hasInactionWarning) {
            console.log(`PR #${itemNumber}: Sending 5-day Inaction warning.`);
            await safeCall(core, "issues.createComment", () =>
              github.rest.issues.createComment({
                owner,
                repo,
                issue_number: itemNumber,
                body: `<!-- cc:pr-inaction-warning -->\n@${owner} 🚨 **PR Inactivity Alert:** This PR has been open for ${Math.round(elapsedHours / 24)} days with no admin response/action. Please review or comment on this PR immediately to prevent a **-10 points** inaction penalty! ⚠️`,
              }),
            );
          }
        }
      }
    } else {
      // --- Issue Activity Logic ---
      const hasAssignee = item.assignees && item.assignees.length > 0;
      const hasOtherLabels = item.labels.some(
        (l) => !["good-issue", "good-pr", "good-ui", "good-backend", "ECSoC26"].includes(l.name),
      );

      const hasIssueAction = hasAdminComment || hasAssignee || hasOtherLabels;

      // Inaction Warning (Issue open > 24 hours, penalty at 36 hours)
      if (!hasIssueAction && elapsedHours >= 24) {
        const hasIssueWarning = comments.some((c) => c.body.includes("cc:issue-inaction-warning"));
        if (!hasIssueWarning) {
          console.log(`Issue #${itemNumber}: Sending 36h Inaction warning.`);
          await safeCall(core, "issues.createComment", () =>
            github.rest.issues.createComment({
              owner,
              repo,
              issue_number: itemNumber,
              body: `<!-- cc:issue-inaction-warning -->\n@${owner} 🚨 **Issue Inactivity Alert:** This issue has been open for ${Math.round(elapsedHours)} hours without any admin action. Please review, comment, label, or assign it soon to prevent a **-5 points** inaction penalty! ⚠️`,
            }),
          );
        }
      }
    }
  }
}
