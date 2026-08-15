import { test, expect } from "@playwright/test";

test.describe("Campus Map Builder DND", () => {
  test("builder loads and displays correctly", async ({ page }) => {
    await page.goto("/map-builder");
    await expect(page.getByTestId("campus-map-builder")).toBeVisible();
  });

  test("dragging snaps component to the grid", async ({ page }) => {
    await page.goto("/map-builder");

    const item = page.getByTestId("draggable-component");
    await expect(item).toBeVisible();

    const box = await item.boundingBox();
    if (!box) {
      throw new Error("Draggable component is not visible");
    }

    // Start drag
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    // Move to raw position (127, 83) relative to start
    const rawX = 127;
    const rawY = 83;
    await page.mouse.move(box.x + box.width / 2 + rawX, box.y + box.height / 2 + rawY, {
      steps: 10,
    });
    await page.mouse.up();

    // The grid size is 20, so snapping should result in (120, 80) if starting at 0
    // We'll assert that the final position coordinates or data attributes match
    // Depending on implementation, it might be in `data-x` attributes or CSS transform
    const expectedX = Math.round(rawX / 20) * 20; // 120 if rawX was absolute from 0
    const expectedY = Math.round(rawY / 20) * 20; // 80 if rawY was absolute from 0

    // Verify resulting state
    await expect(item).toHaveAttribute("data-x", expectedX.toString());
    await expect(item).toHaveAttribute("data-y", expectedY.toString());

    // Verify transform
    const transform = await item.evaluate((element) => getComputedStyle(element).transform);
    expect(transform).not.toBe("none");
  });

  test("negative direction dragging and snapping", async ({ page }) => {
    await page.goto("/map-builder");

    const item = page.getByTestId("draggable-component");
    await expect(item).toBeVisible();

    const box = await item.boundingBox();
    if (!box) throw new Error("Draggable component is not visible");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    const rawX = -43;
    const rawY = -15;
    await page.mouse.move(box.x + box.width / 2 + rawX, box.y + box.height / 2 + rawY, {
      steps: 5,
    });
    await page.mouse.up();

    const expectedX = Math.round(rawX / 20) * 20; // -40
    const expectedY = Math.round(rawY / 20) * 20; // -20

    await expect(item).toHaveAttribute("data-x", expectedX.toString());
    await expect(item).toHaveAttribute("data-y", expectedY.toString());
  });

  test("mobile touch dragging simulates pointer events correctly", async ({ page, isMobile }) => {
    // Only run this test in mobile viewports/contexts
    if (!isMobile) test.skip();

    await page.goto("/map-builder");

    await page.evaluate(() => {
      const element = document.querySelector('[data-testid="draggable-component"]');
      if (!element) {
        throw new Error("Draggable component not found");
      }

      // Simulate pointerdown which is common for mobile DND libraries
      element.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 100,
          clientY: 100,
        }),
      );

      // Simulate pointermove
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 220,
          clientY: 180,
        }),
      );

      // Simulate pointerup
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: 220,
          clientY: 180,
        }),
      );
    });

    const item = page.getByTestId("draggable-component");
    // Depending on the internal implementation, we check if it moved by the delta
    // From 100,100 to 220,180 -> deltaX=120, deltaY=80
    await expect(item).toHaveAttribute("data-x", "120");
    await expect(item).toHaveAttribute("data-y", "80");
  });
});
