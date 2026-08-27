import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModalProvider, useModal } from "./ModalContext";
import { ModalRoot, type ModalRegistrationMap } from "./ModalRoot";

describe("ModalRoot focus trap", () => {
  it("keeps keyboard focus inside the active modal", async () => {
    const registrations: ModalRegistrationMap = {
      BUG_REPORT: {
        render: () => (
          <div role="dialog">
            <button>Close</button>
            <button>Submit</button>
          </div>
        ),
      },
    };
    function Harness() {
      const { openModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("BUG_REPORT")}>Register</button>
          <button>Background</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }
    render(
      <ModalProvider>
        <Harness />
      </ModalProvider>,
    );
    const opener = screen.getByRole("button", { name: "Register" });
    opener.focus();
    await act(async () => {
      opener.click();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    screen.getByRole("button", { name: "Submit" }).focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Background" })).not.toHaveFocus();
  });

  it("handles a modal with no focusable content", async () => {
    const registrations: ModalRegistrationMap = {
      BUG_REPORT: { render: () => <div role="dialog">Registration information</div> },
    };
    function Harness() {
      const { openModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("BUG_REPORT")}>Register</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }
    render(
      <ModalProvider>
        <Harness />
      </ModalProvider>,
    );
    const opener = screen.getByRole("button", { name: "Register" });
    opener.focus();
    await act(async () => {
      opener.click();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    expect(screen.getByTestId("modal-focus-trap")).toHaveFocus();
  });
});
