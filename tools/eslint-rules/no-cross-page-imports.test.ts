import { Rule, RuleTester } from "eslint";
import { describe, it } from "vitest";
import { noCrossPageImports } from "./no-cross-page-imports.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

describe("no-cross-page-imports ESLint Rule", () => {
  it("should validate cross-page import rules", () => {
    ruleTester.run("no-cross-page-imports", noCrossPageImports as unknown as Rule.RuleModule, {
      valid: [
        {
          code: 'import React from "react";',
          filename: "/src/pages/Dashboard.tsx",
        },
        {
          code: 'import { Button } from "@/components/ui/button";',
          filename: "/src/pages/Dashboard.tsx",
        },
        {
          code: 'import { useAuth } from "../../hooks/useAuth";',
          filename: "/src/pages/Dashboard/index.tsx",
        },
        {
          code: 'import { useAuth } from "@/hooks/useAuth";',
          filename: "/src/pages/Dashboard/index.tsx",
        },
        {
          code: 'import { DashboardChart } from "./DashboardChart";',
          filename: "/src/pages/Dashboard/index.tsx",
        },
        {
          code: 'import { formatDate } from "@/lib/utils";',
          filename: "/src/routes/events.tsx",
        },
        {
          code: 'import Directory from "./routes/Directory";',
          filename: "/src/App.tsx",
        },
      ],
      invalid: [
        {
          code: 'import { SettingsPage } from "../Settings";',
          filename: "/src/pages/Dashboard/index.tsx",
          errors: [{ messageId: "noCrossPageImport" }],
        },
        {
          code: 'import { SettingsPage } from "@/pages/Settings";',
          filename: "/src/pages/Dashboard.tsx",
          errors: [{ messageId: "noCrossPageImport" }],
        },
        {
          code: 'import { AuthPage } from "./auth";',
          filename: "/src/routes/events.tsx",
          errors: [{ messageId: "noCrossPageImport" }],
        },
        {
          code: 'import { Dashboard } from "@/routes/dashboard";',
          filename: "/src/components/Header.tsx",
          errors: [{ messageId: "noCrossPageImport" }],
        },
        {
          code: 'import { Admin } from "src/pages/admin";',
          filename: "/src/pages/user/Profile.tsx",
          errors: [{ messageId: "noCrossPageImport" }],
        },
      ],
    });
  });
});
