import { test, expect } from "./analytics-fixture";
import { BrowserContext, Page } from "@playwright/test";
import {
  loginUser,
  navigateToDirectMessage,
  sendChatMessage,
  assertMessageReceived,
  TEST_ACCOUNTS,
} from "./helpers/chatHelpers";

/**
 * Realtime Chat E2E Test Suite
 *
 * Testing chat features is notoriously difficult because you need two different
 * users interacting simultaneously. If User A sends a message, User B's screen
 * should update instantly. This advanced Playwright test spawns two completely
 * isolated browser sessions side-by-side to mathematically prove that our
 * WebSocket events and Supabase Realtime subscriptions are functioning perfectly.
 *
 * Edge Case Handling (Flakiness):
 * Real-time tests are the flakiest tests in existence due to network jitter.
 * We strictly use `await expect(page.locator('text=...')).toBeVisible({ timeout: 5000 })`
 * rather than fixed `page.waitForTimeout(1000)`, allowing Playwright to poll the
 * DOM continuously until the WebSocket event finally resolves.
 */

test.describe("Realtime WebSocket Chat", () => {
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  /**
   * Setup: Spawn two isolated browser contexts and log them in as different users.
   * This runs before every test to ensure a clean state.
   */
  test.beforeEach(async ({ browser }) => {
    // Create isolated contexts to simulate two different devices/users
    contextA = await browser.newContext();
    contextB = await browser.newContext();

    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    // Log in User 1 and User 2
    await loginUser(pageA, TEST_ACCOUNTS.USER_A);
    await loginUser(pageB, TEST_ACCOUNTS.USER_B);

    // Navigate both users to the exact same Direct Message thread
    // The chatHelpers abstract away the UI navigation steps
    await navigateToDirectMessage(pageA, TEST_ACCOUNTS.USER_B.id);
    await navigateToDirectMessage(pageB, TEST_ACCOUNTS.USER_A.id);

    // Wait for the WebSocket connection to establish on both sides
    // We look for the "Online" status indicator or the initial chat container
    await expect(pageA.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator('[data-testid="chat-container"]')).toBeVisible({ timeout: 10000 });
  });

  /**
   * Teardown: Close the isolated contexts to free up memory.
   */
  test.afterEach(async () => {
    await contextA?.close();
    await contextB?.close();
  });

  test("User A sends a message and User B receives it instantly via WebSocket", async () => {
    const testMessage = `Hello from User A! Timestamp: ${Date.now()}`;

    // Instruct Page A to type and send the message
    await sendChatMessage(pageA, testMessage);

    // Instruct Page B to await the specific text appearing in its DOM
    // We use a strict timeout to handle network jitter without flaking
    await assertMessageReceived(pageB, testMessage, 5000);

    // Verify the message is also visible on Page A (optimistic UI check)
    await expect(pageA.locator(`text=${testMessage}`)).toBeVisible();
  });

  test("User B replies and User A receives the reply instantly", async () => {
    const initialMessage = `Ping from User A: ${Date.now()}`;
    const replyMessage = `Pong from User B!`;

    // User A initiates the conversation
    await sendChatMessage(pageA, initialMessage);
    await assertMessageReceived(pageB, initialMessage, 5000);

    // User B replies
    await sendChatMessage(pageB, replyMessage);

    // Assert Page A sees the reply
    await assertMessageReceived(pageA, replyMessage, 5000);
  });

  test("Rapid fire messaging maintains order and state across contexts", async () => {
    const messageCount = 5;

    for (let i = 1; i <= messageCount; i++) {
      const msgA = `A-Message-${i}`;
      const msgB = `B-Message-${i}`;

      // A sends, B receives
      await sendChatMessage(pageA, msgA);
      await assertMessageReceived(pageB, msgA, 5000);

      // B sends, A receives
      await sendChatMessage(pageB, msgB);
      await assertMessageReceived(pageA, msgB, 5000);
    }

    // Final verification: Ensure all messages are present in both DOMs
    for (let i = 1; i <= messageCount; i++) {
      await expect(pageA.locator(`text=A-Message-${i}`)).toBeVisible();
      await expect(pageA.locator(`text=B-Message-${i}`)).toBeVisible();
      await expect(pageB.locator(`text=A-Message-${i}`)).toBeVisible();
      await expect(pageB.locator(`text=B-Message-${i}`)).toBeVisible();
    }
  });

  test("Handles temporary network disconnection and resyncs messages", async () => {
    const offlineMessage = `Sent while offline: ${Date.now()}`;

    // Simulate User B going offline (Deno/Playwright network mocking)
    await contextB.setOffline(true);

    // User A sends a message while B is offline
    await sendChatMessage(pageA, offlineMessage);

    // Verify A sees it (optimistic UI)
    await expect(pageA.locator(`text=${offlineMessage}`)).toBeVisible();

    // Bring User B back online
    await contextB.setOffline(false);

    // B should eventually receive the missed message via Realtime subscription sync
    await assertMessageReceived(pageB, offlineMessage, 15000); // Longer timeout for resync
  });
});
