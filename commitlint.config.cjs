/**
 * Commitlint configuration.
 *
 * Enforces the Conventional Commits specification (https://www.conventionalcommits.org/)
 * for every commit message, matching the types documented in CONTRIBUTING.md.
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "build", "ci"],
    ],
    "subject-case": [0],
  },
};
