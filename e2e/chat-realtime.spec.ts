import { test, expect } from "./analytics-fixture";

test("real-time chat with multiple browser contexts and typing indicators", async ({ browser }) => {
  // 1. Create Context A (User A: Admin User)
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  // 2. Create Context B (User B: John Doe)
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  // 3. Authenticate User A
  await pageA.goto("/auth");
  await pageA.locator('input[placeholder="you@college.edu"]').fill("admin@campusconnect.edu");
  await pageA.locator('input[placeholder="********"]').fill("password123");
  await pageA.getByRole("button", { name: "Sign in" }).click();
  await pageA.waitForURL("/dashboard");

  // 4. Authenticate User B
  await pageB.goto("/auth");
  await pageB.locator('input[placeholder="you@college.edu"]').fill("student@campusconnect.edu");
  await pageB.locator('input[placeholder="********"]').fill("password123");
  await pageB.getByRole("button", { name: "Sign in" }).click();
  await pageB.waitForURL("/dashboard");

  // 5. Navigate both pages to the /messages route
  await pageA.goto("/messages");
  await pageB.goto("/messages");

  // Wait for establishing key agreements to load
  await pageA.waitForLoadState("networkidle");
  await pageB.waitForLoadState("networkidle");

  // 6. User A clicks on "John Doe" in the ContactList
  const contactJohn = pageA.getByRole("button").filter({ hasText: "John Doe" }).first();
  await contactJohn.click();

  // User B clicks on "Admin User" in the ContactList
  const contactAdmin = pageB.getByRole("button").filter({ hasText: "Admin User" }).first();
  await contactAdmin.click();

  // Establish secure E2EE keys (Wait for Establish to disappear or messages input to appear)
  const inputA = pageA.locator('input[placeholder="Type a secure message..."]').first();
  const inputB = pageB.locator('input[placeholder="Type a secure message..."]').first();
  await expect(inputA).toBeVisible({ timeout: 15000 });
  await expect(inputB).toBeVisible({ timeout: 15000 });

  // 7. User A types a message (triggering typing indicators)
  await inputA.focus();
  await inputA.fill("Hello John, this is Admin!");

  // 8. Assert that Context B shows typing indicator for "Admin User"
  const typingIndicatorB = pageB.locator("text=Admin User is typing…");
  await expect(typingIndicatorB).toBeVisible();

  // 9. User A submits the message
  await pageA.keyboard.press("Enter");

  // 10. Assert Context B receives the message instantly via Realtime / WebSocket events
  const receivedMessageB = pageB.locator("text=Hello John, this is Admin!").first();
  await expect(receivedMessageB).toBeVisible({ timeout: 10000 });

  // 11. User B replies (triggering typing indicators in Context A)
  await inputB.focus();
  await inputB.fill("Hello Admin, got your message!");

  // Assert Context A shows typing indicator for "John Doe"
  const typingIndicatorA = pageA.locator("text=John Doe is typing…");
  await expect(typingIndicatorA).toBeVisible();

  // Submit reply
  await pageB.keyboard.press("Enter");

  // 12. Assert Context A receives the reply
  const receivedMessageA = pageA.locator("text=Hello Admin, got your message!").first();
  await expect(receivedMessageA).toBeVisible({ timeout: 10000 });

  // Cleanup
  await contextA.close();
  await contextB.close();
});
