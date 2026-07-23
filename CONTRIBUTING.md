# Contributing to CampusConnect

Welcome to **CampusConnect**! We are thrilled to have you here. This project is participating in the **Elite Coders Summer of Code (ECSoC) 2026**. Whether you're fixing a bug, adding a new feature, or improving documentation, your contributions help make campus life easier for everyone.

## 📋 Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher recommended)
- **npm** (included with Node.js)
- **Supabase CLI** (if you need to run or test backend migrations locally)
- Basic familiarity with **React, TypeScript, and Tailwind CSS**

## 🛠️ Step-by-Step Contribution Guide

1. **Fork the Repository**
   Click the "Fork" button at the top right of this repository to create your own copy.

2. **Clone Your Fork**

   ```bash
   git clone [https://github.com/YOUR_USERNAME/CampusConnect.git](https://github.com/YOUR_USERNAME/CampusConnect.git)
   cd CampusConnect
   ```

3. **Install Dependencies**
   Install the necessary packages to run the project locally.

   ```bash
   npm install
   ```

4. **Set Up Environment Variables**
   Copy the example environment file and update it with your local or preview Supabase credentials.

   ```bash
   cp .env.example .env.local
   ```

5. **Start the Development Server**
   Run the application locally to see your changes in real-time. The app will typically be available at `http://localhost:3000`.

   ```bash
   npm run dev
   ```

6. **Create a Branch**
   Create a new branch for your work. Use the following naming convention —
   a short-form type prefix, a slash, then a brief kebab-case description:
   - `feat/your-feature-name` (for new features)
   - `fix/your-bug-fix` (for bug fixes)
   - `docs/your-docs-update` (for documentation)

   ```bash
   git checkout -b feat/awesome-new-feature
   ```

7. **Make Your Changes**
   Write your code, add components, or update documentation. Ensure you test your changes locally!

8. **Commit Your Changes**
   We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Please use one of the following prefixes for your commit messages:
   - `feat:` (New feature)
   - `fix:` (Bug fix)
   - `docs:` (Documentation changes)
   - `style:` (Formatting, missing semicolons, etc.; no code change)
   - `refactor:` (Refactoring production code)
   - `test:` (Adding tests, refactoring test; no production code change)

   ```bash
   git commit -m "feat: add user profile page skeleton"
   ```

9. **Push to Your Fork**

   ```bash
   git push origin feature/awesome-new-feature
   ```

10. **Open a Pull Request**
    Go to the original repository and you will see a prompt to open a Pull Request.

## 📝 Pull Request Guidelines

- **Link the Issue:** Always mention the issue your PR solves (e.g., `Closes #123`).
- **Keep it Focused:** Try to keep your PR small and focused on a single task or issue.
- **Add Screenshots:** If your change affects the UI, please include before/after screenshots in the PR description.
- **Pass CI:** Ensure your code passes all checks (build and lint) in GitHub Actions.

## 🔒 Branch Protection Rules

To keep `main` stable and deployable at all times, the following rules apply:

- **No direct commits to `main`.** All changes — including documentation and
  small fixes — must go through a Pull Request from a feature branch on your
  fork.
- **Branch naming is enforced by convention** (see step 6 above): use the
  `feat/`, `fix/`, or `docs/` prefix that matches the type of change.
- **CI must pass before merging.** Every PR runs automated lint and build
  checks; a PR with failing checks will not be merged until it's fixed.
- **Keep your branch up to date.** Before opening a PR, sync your branch with
  the latest `upstream/main` to avoid merge conflicts:

  ```bash
  git fetch upstream
  git merge upstream/main
  ```

- **One issue, one PR.** Avoid bundling unrelated changes into a single PR —
  it slows down review and makes it harder to merge safely.

This project uses **ESLint** and **Prettier** to maintain code quality. **Failing to format your code will cause your Pull Request CI checks to fail!**

Before committing any code, you **MUST** run the auto-fix linter command to format your files:

```bash
npm run lint
```

This command will automatically fix spacing, missing quotes, and other formatting issues. If it reports any remaining errors that cannot be auto-fixed, you must resolve them manually before pushing.

_(Highly Recommended: Configure your code editor to "Format on Save" using the Prettier extension)._

## 🔐 Edge Function Authentication

Custom Supabase Edge Functions should use the shared authentication middleware located at:

`supabase/functions/shared/auth-middleware.ts`

Example:

```ts
import { verifyAuth } from "../shared/auth-middleware.ts";

const user = await verifyAuth(req, supabase);
```

The middleware validates the Bearer JWT and returns the authenticated user. Invalid or missing tokens should result in an HTTP 401 response.

## 🙋 How to Claim an Issue

This repository uses an automated bot to assign issues to contributors!

1. Find an unassigned issue you want to work on (look for the `good-first-issue` label if you're new!).
2. Leave a comment on the issue saying exactly: `/claim`.
3. The bot will automatically assign the issue to you. You can only have a maximum of 7 active issues at a time.
4. **Time Limit:** There is no strict time limit to open a Pull Request. However, please try to drop a quick progress update occasionally if you're taking a long time, so we know you are still working on it.
5. If you change your mind and no longer want to work on the issue, comment `/unclaim` to release it.

## 🏷️ Issue Labels Guide

- **Difficulty:** `good-first-issue`, `intermediate`, `advanced`
- **Area:** `frontend`, `backend`, `database`, `docs`, `design`
- **Type:** `bug`, `enhancement`, `help-wanted`

## 📜 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. By participating in this project, you agree to abide by our Code of Conduct. Please be kind, respectful, and constructive in your interactions with other contributors.

## 💬 Communication Channel

Got questions? Need help? Join the discussion!

<!-- TODO: Replace with the actual Discord/Slack invite link -->

**👉 Join the ECSoC Project Discord / Slack Here** _(link coming soon)_

Thank you for contributing! 🚀
