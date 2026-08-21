import {
  test as base,
  expect,
  type BrowserContext,
  type BrowserContextOptions,
  type Route,
} from "@playwright/test";

export const ANALYTICS_PATTERN =
  /\.?(google-analytics\.com|googletagmanager\.com|analytics\.google\.com|stats\.g\.doubleclick\.net|posthog\.com|mixpanel\.com|segment\.(io|com)|amplitude\.com|hotjar\.com|clarity\.ms|fullstory\.com)/i;

async function blockAnalytics(route: Route): Promise<void> {
  if (ANALYTICS_PATTERN.test(route.request().url())) {
    await route.abort("blockedbyclient");
    return;
  }
  await route.continue();
}

export const test = base.extend({
  browser: async ({ browser }, use) => {
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options?: BrowserContextOptions): Promise<BrowserContext> => {
      const context = await originalNewContext(options);
      await context.route("**/*", blockAnalytics);
      return context;
    };

    await use(browser);
  },
});

export { expect };
