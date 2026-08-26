import { test, expect } from "./analytics-fixture";

test.describe("Dark Mode Visual Regression: Global Feed", () => {
  test.beforeEach(async ({ context }) => {
    // Intercept/mock supabase API requests to ensure a completely frozen layout
    await context.route("**/functions/v1/get-feed*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          edges: [
            {
              cursor: "cursor1",
              node: {
                id: "post-1",
                content:
                  "Welcome to CampusConnect! This is a visual regression test for dark mode.",
                created_at: "2026-08-03T12:00:00Z",
                club_id: "club-1",
                is_pinned: true,
                profiles: {
                  id: "user-1",
                  full_name: "Test User",
                  handle: "testuser",
                },
                clubs: {
                  id: "club-1",
                  name: "Testing Club",
                },
                comments: [],
                post_reactions: [],
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: "cursor1",
          },
        }),
      });
    });

    await context.route("**/rest/v1/club_members*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await context.route("**/rest/v1/profiles*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ role: "USER" }),
      });
    });
  });

  test("should render Global Feed correctly in both light and dark mode", async ({ page }) => {
    // Set theme to system in localStorage first
    await page.addInitScript(() => {
      window.localStorage.setItem("campusconnect-theme", "system");
    });

    await page.goto("/feed");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000); // Allow content to settle

    // 1. Force the browser into light mode
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForTimeout(1000); // Allow transition to complete
    expect(await page.screenshot()).toMatchSnapshot("feed-light.png");

    // 2. Force the browser into dark mode
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(1000); // Allow transition to complete
    expect(await page.screenshot()).toMatchSnapshot("feed-dark.png");
  });
});
