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
   git clone https://github.com/YOUR_USERNAME/CampusConnect.git
   cd CampusConnect
   ```

3. **Create a Branch**
   Create a new branch for your work. Use a descriptive naming convention:
   - `feature/your-feature-name` (for new features)
   - `fix/your-bug-fix` (for bug fixes)
   - `docs/your-docs-update` (for documentation)

   ```bash
   git checkout -b feature/awesome-new-feature
   ```

4. **Make Your Changes**
   Write your code, add components, or update documentation.

5. **Commit Your Changes**
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

6. **Push to Your Fork**

   ```bash
   git push origin feature/awesome-new-feature
   ```

7. **Open a Pull Request**
   Go to the original repository and you will see a prompt to open a Pull Request.

## 📝 Pull Request Guidelines

- **Link the Issue:** Always mention the issue your PR solves (e.g., `Closes #123`).
- **Keep it Focused:** Try to keep your PR small and focused on a single task or issue.
- **Add Screenshots:** If your change affects the UI, please include before/after screenshots in the PR description.
- **Pass CI:** Ensure your code passes all checks (build and lint) in GitHub Actions.

## 💅 Code Style & Formatting (CRITICAL)

This project uses **ESLint** and **Prettier** to maintain code quality. **Failing to format your code will cause your Pull Request CI checks to fail!**

Before committing any code, you **MUST** run the auto-fix linter command to format your files:

```bash
npm run lint
```

This command will automatically fix spacing, missing quotes, and other formatting issues. If it reports any remaining errors that cannot be auto-fixed, you must resolve them manually before pushing.

_(Highly Recommended: Configure your code editor to "Format on Save" using the Prettier extension)._

## 🙋 How to Claim an Issue

To prevent duplicate work:

1. Find an issue you want to work on (look for the `good-first-issue` label if you're new!).
2. Leave a comment saying: **"I'd like to work on this!"**
3. **Wait for a maintainer to assign you** to the issue before starting your work.

## 🏷️ Issue Labels Guide

- **Difficulty:** `good-first-issue`, `intermediate`, `advanced`
- **Area:** `frontend`, `backend`, `database`, `docs`, `design`
- **Type:** `bug`, `enhancement`, `help-wanted`

## 💬 Communication Channel

Got questions? Need help? Join the discussion!

<!-- TODO: Replace with the actual Discord/Slack invite link -->

**👉 Join the ECSoC Project Discord / Slack Here** _(link coming soon)_

Thank you for contributing! 🚀
