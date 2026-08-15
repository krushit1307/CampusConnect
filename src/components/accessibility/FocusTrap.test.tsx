import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { FocusTrap } from "./FocusTrap";

const waitForFocus = () =>
  act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

describe("FocusTrap", () => {
  it("focuses the first control", async () => {
    render(
      <FocusTrap>
        <button>First</button>
        <button>Last</button>
      </FocusTrap>,
    );
    await waitForFocus();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    render(
      <FocusTrap>
        <button>First</button>
        <button>Last</button>
      </FocusTrap>,
    );
    await waitForFocus();
    screen.getByRole("button", { name: "Last" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("focuses the wrapper when there are no controls", async () => {
    render(
      <FocusTrap data-testid="focus-trap">
        <p>Announcement</p>
      </FocusTrap>,
    );
    await waitForFocus();
    expect(screen.getByTestId("focus-trap")).toHaveFocus();
  });

  it("returns focus to the opener", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Register";
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <FocusTrap>
        <button>Close</button>
      </FocusTrap>,
    );
    await waitForFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
