import test from "node:test";
import assert from "node:assert/strict";
import { processClaim, processUnclaim } from "../claim.js";
import { processIssueCommentGuidance, processFirstIssueWelcome } from "../issue-comments.js";
import { processManualAssignment } from "../assignment.js";
import { processPrValidation, processPrMerged, processFirstContributorWelcome } from "../pr.js";
import { processIssueLifecycle } from "../lifecycle.js";
import { processClaimExpiration } from "../expiration.js";
import { processActivityReminder } from "../activity-reminder.js";

function createCore() {
  return { info() {}, warning() {}, error() {} };
}

function createGithub(issueFactory) {
  const state = {
    comments: [],
    assignees: {},
    issues: {},
    pulls: [],
  };
  return {
    state,
    rest: {
      issues: {
        async get({ issue_number }) {
          return {
            data: issueFactory(issue_number, state, state.issues[issue_number] || {}),
          };
        },
        async createComment({ issue_number, body }) {
          state.comments.push({ issue_number, body });
          return { data: { id: state.comments.length, body } };
        },
        async updateComment({ comment_id, body }) {
          const idx = comment_id - 1;
          state.comments[idx] = { ...state.comments[idx], body };
          return { data: state.comments[idx] };
        },
        async addAssignees({ issue_number, assignees }) {
          state.assignees[issue_number] = assignees[0];
          return { data: {} };
        },
        async removeAssignees({ issue_number }) {
          delete state.assignees[issue_number];
          return { data: {} };
        },
        async update({ issue_number, body, state: issueState }) {
          state.issues[issue_number] = state.issues[issue_number] || {};
          if (body !== undefined) state.issues[issue_number].body = body;
          if (issueState !== undefined) state.issues[issue_number].state = issueState;
          return {
            data: issueFactory(issue_number, state, state.issues[issue_number]),
          };
        },
        async listComments() {
          return { data: state.comments };
        },
      },
      repos: {
        async getCollaboratorPermissionLevel({ username }) {
          const permission =
            username === "maintainer" ? "write" : username === "owner" ? "admin" : "read";
          return { data: { permission } };
        },
      },
      pulls: {
        async get({ pull_number }) {
          return { data: { number: pull_number } };
        },
        async list() {
          return { data: state.pulls };
        },
      },
    },
    async paginate(apiMethod, args) {
      if (apiMethod === this.rest.issues.listComments)
        return this.rest.issues.listComments(args).then((r) => r.data);
      if (args.assignee) {
        return new Array(args.assignee === "busy-user" ? 10 : 1).fill(0).map((_, i) => ({
          number: i + 1,
          title: `Issue ${i + 1}`,
        }));
      }
      return Object.keys(state.assignees).map((n) => ({
        number: Number(n),
        state: "open",
        assignees: [{ login: state.assignees[n] }],
      }));
    },
  };
}

function baseContext(action = "created") {
  return {
    eventName: "issue_comment",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action,
      repository: { archived: false },
      issue: {
        number: 10,
        state: "open",
        locked: false,
        user: { login: "issue-author" },
        author_association: "CONTRIBUTOR",
        assignees: [],
      },
      comment: {
        body: "/claim",
        user: { login: "issue-author", type: "User" },
      },
    },
  };
}

function issueFactory(issueNumber, state, overrides = {}) {
  const assignee = state.assignees[issueNumber];
  return {
    number: issueNumber,
    state: overrides.state || "open",
    locked: false,
    body: overrides.body || "",
    user: overrides.user || { login: "issue-author" },
    author_association: overrides.author_association || "CONTRIBUTOR",
    assignees: overrides.assignees || (assignee ? [{ login: assignee }] : []),
    updated_at: new Date().toISOString(),
  };
}

test("claim: first valid claim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], "issue-author");
});

test("claim: duplicate claim ignored", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "issue-author";
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.equal(github.state.comments.length, 0);
});

test("claim: already assigned", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "other-user";
  const context = baseContext();
  await processClaim({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("already working on this one")));
});

test("claim: max 10 active issues", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.user.login = "busy-user";
  context.payload.issue.user.login = "busy-user";
  github.state.issues[10] = {
    user: { login: "busy-user" },
    author_association: "CONTRIBUTOR",
  };
  await processClaim({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("the max is **10**")));
});

test("unclaim: unauthorized unclaim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "random-user";
  await processUnclaim({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("Only @assigned-user")));
});

test("unclaim: maintainer can unclaim", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[10] = "assigned-user";
  const context = baseContext();
  context.payload.comment.body = "/unclaim";
  context.payload.comment.user.login = "maintainer";
  await processUnclaim({ github, context, core: createCore() });
  assert.equal(github.state.assignees[10], undefined);
});

test("issue guidance: natural language claim with cooldown", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = baseContext();
  context.payload.comment.body = "please assign this to me";
  context.payload.comment.user.login = "contributor";
  await processIssueCommentGuidance({ github, context, core: createCore() });
  await processIssueCommentGuidance({ github, context, core: createCore() });
  const matches = github.state.comments.filter((c) =>
    c.body.toLowerCase().includes("to claim this issue"),
  );
  assert.ok(matches.length <= 1);
});

test("manual assignment: creates welcome once", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "assigned",
      sender: { login: "maintainer", type: "User" },
      issue: { number: 10 },
      assignee: { login: "new-user" },
    },
  };
  await processManualAssignment({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("now assigned")));
});

test("pr validation: missing linked issue", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      pull_request: {
        number: 20,
        body: "Small fix",
        user: { login: "contributor" },
        head: { ref: "feature/my-fix" },
        draft: false,
      },
    },
  };
  await processPrValidation({ github, context, core: createCore() });
  assert.ok(github.state.comments.some((c) => c.body.includes("Linked issue")));
});

test("pr merged: closes linked issues and preserves assignees", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  github.state.assignees[15] = "issue-author";
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "closed",
      pull_request: {
        number: 25,
        merged: true,
        body: "Closes #15",
        user: { login: "contributor" },
      },
    },
  };
  await processPrMerged({ github, context, core: createCore() });
  assert.equal(github.state.assignees[15], "issue-author");
});

test("first contributor welcome only once", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      pull_request: {
        number: 30,
        author_association: "FIRST_TIME_CONTRIBUTOR",
        user: { login: "first-timer" },
      },
    },
  };
  await processFirstContributorWelcome({ github, context, core: createCore() });
  await processFirstContributorWelcome({ github, context, core: createCore() });
  const comments = github.state.comments.filter((c) => c.issue_number === 30);
  assert.ok(comments.length <= 1);
});

test("first issue welcome creates greeting once on first issue", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      issue: {
        number: 40,
        author_association: "FIRST_TIME_CONTRIBUTOR",
        user: { login: "first-issue-author", type: "User" },
      },
    },
  };
  await processFirstIssueWelcome({ github, context, core: createCore() });
  await processFirstIssueWelcome({ github, context, core: createCore() });
  const comments = github.state.comments.filter((c) => c.issue_number === 40);
  assert.equal(comments.length, 1);
  assert.ok(comments[0].body.includes("cc:first-issue-welcome"));
  assert.ok(comments[0].body.includes("welcome to the **CampusConnect** community"));
});

test("first issue welcome ignores bot user", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub(issueFactory);
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: {
      action: "opened",
      issue: {
        number: 41,
        author_association: "NONE",
        user: { login: "dependabot[bot]", type: "Bot" },
      },
    },
  };
  await processFirstIssueWelcome({ github, context, core: createCore() });
  const comments = github.state.comments.filter((c) => c.issue_number === 41);
  assert.equal(comments.length, 0);
});

test("issue lifecycle close clears metadata and preserves assignees", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: '<!-- cc:metadata:start -->\n{"assignedAt":"2020-01-01T00:00:00.000Z"}\n<!-- cc:metadata:end -->',
      assignees: [{ login: "assigned-user" }],
    }),
  );
  github.state.assignees[10] = "assigned-user";
  const context = {
    eventName: "issues",
    repo: { owner: "org", repo: "repo" },
    payload: { action: "closed", issue: { number: 10 } },
  };
  await processIssueLifecycle({ github, context, core: createCore() });
  assert.ok(String(github.state.issues[10]?.body || "").includes('"assignedAt": null'));
  assert.equal(github.state.assignees[10], "assigned-user");
});

test("expiration: reminder and expiration paths", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 150 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- cc:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- cc:metadata:end -->`,
    }),
  );
  github.state.assignees[50] = "assigned-user";
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };
  await processClaimExpiration({ github, context, core: createCore() });
  assert.equal(github.state.assignees[50], undefined);
});

test("expiration: skipped if user has an open linked PR", async () => {
  process.env.GITHUB_REPOSITORY = "org/repo";
  const oldDate = new Date(Date.now() - 150 * 60 * 60 * 1000).toISOString();
  const github = createGithub((number, state) =>
    issueFactory(number, state, {
      body: `<!-- cc:metadata:start -->\n{"assignedAt":"${oldDate}","lastActivityAt":"${oldDate}"}\n<!-- cc:metadata:end -->`,
    }),
  );
  github.state.assignees[50] = "assigned-user";
  github.state.pulls = [
    {
      number: 55,
      user: { login: "assigned-user" },
      body: "Closes #50",
    },
  ];
  const context = {
    eventName: "schedule",
    repo: { owner: "org", repo: "repo" },
    payload: {},
  };
  await processClaimExpiration({ github, context, core: createCore() });
  assert.equal(github.state.assignees[50], "assigned-user");
});

test("activity reminder: warns for inactive PR and issue", async () => {
  const commentsCreated = [];
  const github = {
    rest: {
      issues: {
        listForRepo: () => {},
        listComments: () => {},
        createComment: async ({ issue_number, body }) => {
          commentsCreated.push({ issue_number, body });
          return { data: {} };
        },
      },
      pulls: {
        listReviews: async () => {
          return { data: [] }; // No admin reviews
        },
      },
    },
    async paginate(apiMethod, args) {
      if (apiMethod === this.rest.issues.listForRepo) {
        // Return 1 open PR and 1 open issue
        return [
          {
            number: 101,
            pull_request: {},
            created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
            labels: [{ name: "ECSoC26" }],
            assignees: [],
          },
          {
            number: 102,
            created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago
            labels: [{ name: "good-issue" }],
            assignees: [],
          },
        ];
      }
      if (apiMethod === this.rest.issues.listComments) {
        // No comments yet
        return [];
      }
      return [];
    },
  };

  const context = {
    repo: { owner: "org", repo: "repo" },
  };

  await processActivityReminder({ github, context, core: createCore() });

  // Both should get warnings:
  // PR 101 should get first response warning (since it has been 20 hours and is ECSoC26 PR)
  // Issue 102 should get issue inaction warning (since it has been 30 hours with no action)
  assert.ok(
    commentsCreated.some(
      (c) => c.issue_number === 101 && c.body.includes("cc:pr-first-response-warning"),
    ),
  );
  assert.ok(
    commentsCreated.some(
      (c) => c.issue_number === 102 && c.body.includes("cc:issue-inaction-warning"),
    ),
  );
});
