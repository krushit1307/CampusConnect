import { AUTOMATION, COMMANDS } from "./constants.js";

import { withMarker } from "./utils.js";

export const comments = {
  successfulClaim: ({ user, issueNumber }) =>
    withMarker(
      AUTOMATION.claimWelcomeMarker,
      `Hey @${user}, awesome to have you on board for this! 🚀\n\n` +
        `We've officially assigned issue #${issueNumber} to you. Be sure to check out our **CONTRIBUTING.md** before starting, and keep your PR scoped to this issue for an easier review process.\n\n` +
        `Can't wait to see your work. Happy coding! ✨`,
    ),

  alreadyAssigned: ({ assignee }) =>
    `Hey there, thanks for checking out this issue! 🙌\n\n` +
    `It looks like @${assignee} is already working on this one, so it's not available to claim right now.\n\n` +
    `Don't worry though! We have plenty of other open issues you can pick from. We're excited to see your contributions! ✨`,

  maxIssueLimitReached: ({ user, activeCount }) =>
    `Hey @${user}, we love the energy! 🌟\n\n` +
    `You've reached our limit with **${activeCount} active assigned issues** (the max is **10**). This helps ensure everyone gets a chance to contribute.\n\n` +
    `Once you finish or release an active issue (using \`${COMMANDS.unclaim}\`), you can definitely claim another one!`,

  invalidClaim: ({ user }) =>
    `Hi @${user}, thanks for wanting to jump in! 😊\n\n` +
    `To claim an issue, please comment exactly \`${COMMANDS.claim}\` (no extra text).\n\n` +
    `If you're new here, **CONTRIBUTING.md** has the full contribution workflow to help you get started smoothly.`,

  wrongIssueAuthorClaimAttempt: ({ user, issueAuthor }) =>
    `Hi @${user}, thank you for your interest in this issue! 🙏\n\n` +
    `This particular issue was opened by @${issueAuthor}, and for contributor-opened issues, automatic claiming is limited to the issue author.\n\n` +
    `We really appreciate your eagerness to contribute — please feel free to browse our other open issues, there's likely a great fit for you!`,

  duplicateClaim: ({ user }) =>
    `Hi @${user}, good news — you already have this issue assigned to you! ✅\n\n` +
    `Feel free to continue your work, and share updates here anytime. We're rooting for you! 💪`,

  successfulUnclaim: ({ assignee }) =>
    `Thanks so much, @${assignee}, for letting us know! 🙏\n\n` +
    `This issue has been released and is now open for other contributors to claim.\n\n` +
    `We really appreciate your honesty, and we'd love to see you back on another issue whenever you're ready!`,

  unauthorizedUnclaim: ({ actor, assignee }) =>
    `Hi @${actor}, thanks for reaching out! 😊\n\n` +
    `Only @${assignee} or a maintainer can use \`${COMMANDS.unclaim}\` on this issue. If you believe this needs attention, feel free to tag a maintainer for help.`,

  noActiveClaimToRelease: ({ user }) =>
    `Hi @${user}, thanks for checking in! 🙂\n\n` +
    `There's no active claim on this issue right now.\n\n` +
    `If you'd like to work on it, just comment \`${COMMANDS.claim}\` and it's yours!`,

  manualAssignmentWelcome: ({ assignee, issueNumber }) =>
    withMarker(
      AUTOMATION.assignmentWelcomeMarker,
      `Hi @${assignee}, welcome aboard! 🎉\n\n` +
        `You are now assigned to issue #${issueNumber}. Please follow **CONTRIBUTING.md** and keep your PR focused on this issue.\n\n` +
        `If anything blocks you along the way, just leave a short update here — we're happy to help. Looking forward to your contribution! 🚀`,
    ),

  prOpened: ({ user, prNumber, prTitle }) =>
    `Hi @${user}, thank you so much for opening PR #${prNumber} (**${prTitle}**)! 🎉\n\n` +
    `A quick validation pass is running now. If anything is missing, you'll see it below with clear next steps — nothing to worry about, we're here to help you get it merge-ready. 💙`,

  welcomeMessage: ({ user }) =>
    withMarker(
      AUTOMATION.firstIssueWelcomeMarker,
      `Hey @${user}, welcome to the **CampusConnect** community! 🎉\n\n` +
        `We are thrilled to have you! A great place to start is **CONTRIBUTING.md**. If you get stuck, don't hesitate to ask for help in Discussions.\n\n` +
        `Can't wait to see your awesome contributions! 🌟`,
    ),

  prValidationChecklist: ({ body }) => withMarker(AUTOMATION.prChecklistMarker, body),

  prValidationSummary: ({ lines, missingLinkedIssueText, missingDescriptionText }) =>
    `Hi @${lines.author}, thank you so much for your PR! 🎉\n\n` +
    `### 📋 PR Review Checklist\n\n${lines.items.join("\n")}\n\n${missingLinkedIssueText}${missingDescriptionText}` +
    `\nWe appreciate the effort you've put in — let us know if you need any help getting this across the finish line! 💪`,

  missingLinkedIssue: () =>
    "🔗 Please link at least one issue in the PR description (for example `Closes #123`). This helps us keep everything organized!\n",

  missingAssignment: ({ issueNumber, assignee }) =>
    `👀 Issue #${issueNumber} is currently assigned to @${assignee}. Please coordinate with the assignee, or feel free to ask a maintainer for an override if needed — we're happy to help sort things out!`,

  missingPrDescription: () =>
    "📝 Please add a clear PR description explaining what changed, why it changed, and how you tested it. A good description makes review so much smoother — thanks for taking the time!",

  issueClosed: ({ user, issueNumber }) =>
    `Hi @${user}, just letting you know issue #${issueNumber} has been closed. Claim reminders and assignment metadata were cleaned up automatically. Thanks for your involvement! 🙏`,

  issueReopened: ({ user, issueNumber }) =>
    `Hi @${user}, heads up — issue #${issueNumber} has been reopened. 🔄\n\n` +
    `Claim tracking has been reset so new activity is tracked correctly. Thanks for your patience!`,

  prMergedCongratulations: ({ user, prNumber, prTitle, issuesText }) =>
    withMarker(
      AUTOMATION.mergedMarker,
      `Hi @${user}, thank you so much for this solid contribution! 🎉🚀\n\n` +
        `Your PR #${prNumber} (**${prTitle}**) has been merged. ✅\n\n` +
        `${issuesText}\n\n` +
        `Your addition is a perfect fit for the project and we really appreciate your work! Hope to see more from you soon. 🌟\n\n` +
        `⭐ If you like **CampusConnect**, a star on the repo goes a long way!`,
    ),

  firstContributorWelcome: ({ user }) =>
    withMarker(
      AUTOMATION.firstWelcomeMarker,
      `Hey @${user}, a massive welcome to **CampusConnect**! 🎉\n\n` +
        `Congratulations on your first contribution! 🎉 Check out **CONTRIBUTING.md** if you haven't already, and use Discussions if you ever need help or feedback.\n\n` +
        `So glad to have you with us. Cheers to many more! 🌟`,
    ),

  naturalLanguageClaimGuidance: ({ user }) =>
    `Hi @${user}, thanks so much for your interest in this issue! 😊\n\n` +
    `To claim it, just comment exactly \`${COMMANDS.claim}\`.\n\n` +
    `You can also check out **CONTRIBUTING.md** for the full contribution flow. We're excited to see you get started!`,

  issueAlreadyClaimed: ({ user }) =>
    `Hi @${user}, this issue is already assigned to you! ✅\n\n` +
    `Feel free to continue and share your progress here anytime — we're cheering you on! 💪`,

  issueUnavailable: ({ user }) =>
    `Hi @${user}, thanks for your interest! 🙏\n\n` +
    `Unfortunately, this issue isn't available to claim right now (it may be closed, locked, or archived).\n\n` +
    `No worries — there are plenty of other great issues open. Take a look and find one that suits you!`,

  maintainerOverrideNotification: ({ actor, target }) =>
    withMarker(
      AUTOMATION.overrideMarker,
      `🔧 Maintainer update by @${actor}: assignment state was adjusted for @${target}.`,
    ),
};
