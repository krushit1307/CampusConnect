import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ModalProvider, useModal } from "./ModalContext";
import { ModalRoot, type ModalRegistrationMap } from "./ModalRoot";

function withProvider(children: ReactNode) {
  return <ModalProvider>{children}</ModalProvider>;
}

describe("ModalRoot — idle state (issue #1916)", () => {
  it("renders nothing when no modal is active", () => {
    render(withProvider(<ModalRoot registrations={{}} />));
    expect(screen.queryByTestId("modal-root")).not.toBeInTheDocument();
  });
});

describe("ModalRoot — active state (issue #1916)", () => {
  it("renders the registered component for the active kind", () => {
    const registrations: ModalRegistrationMap = {
      BUG_REPORT: { render: () => <div data-testid="bug-report-body">Bug form</div> },
    };

    function Harness() {
      const { openModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("BUG_REPORT")}>Open</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }

    render(withProvider(<Harness />));
    expect(screen.queryByTestId("bug-report-body")).not.toBeInTheDocument();
    act(() => screen.getByRole("button", { name: /open/i }).click());
    expect(screen.getByTestId("modal-root")).toBeInTheDocument();
    expect(screen.getByTestId("modal-root")).toHaveAttribute("data-active-modal", "BUG_REPORT");
    expect(screen.getByTestId("bug-report-body")).toBeInTheDocument();
  });

  it("passes modalProps through to the render function", () => {
    const renderSpy = vi.fn().mockReturnValue(<div data-testid="share-modal" />);
    const registrations: ModalRegistrationMap = {
      SHARE: { render: renderSpy },
    };

    function Harness() {
      const { openModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("SHARE", { url: "https://x.test" })}>share</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }

    render(withProvider(<Harness />));
    act(() => screen.getByRole("button", { name: /share/i }).click());
    expect(renderSpy).toHaveBeenCalledWith({ url: "https://x.test" });
  });

  it("renders nothing (with a warning) when no registration exists for the kind", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    function NoMatchHarness() {
      const { openModal } = useModal();
      // FILTERS has no registration in the registrations object below.
      return <button onClick={() => openModal("FILTERS")}>open-filters</button>;
    }
    render(
      withProvider(
        <>
          <NoMatchHarness />
          <ModalRoot registrations={{}} />
        </>,
      ),
    );
    act(() => screen.getByRole("button", { name: /open-filters/i }).click());
    expect(screen.queryByTestId("modal-root")).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No registration"));
    warnSpy.mockRestore();
  });

  it("REPLACES the visible modal when a different one opens (issue #1916)", () => {
    const registrations: ModalRegistrationMap = {
      LOGIN: { render: () => <div data-testid="login-modal">Login</div> },
      FILTERS: { render: () => <div data-testid="filters-modal">Filters</div> },
    };

    function Harness() {
      const { openModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("LOGIN")}>login</button>
          <button onClick={() => openModal("FILTERS")}>filters</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }

    render(withProvider(<Harness />));
    act(() => screen.getByRole("button", { name: /login/i }).click());
    expect(screen.getByTestId("login-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("filters-modal")).not.toBeInTheDocument();

    // Opening FILTERS while LOGIN is active swaps the rendered child.
    act(() => screen.getByRole("button", { name: /filters/i }).click());
    expect(screen.queryByTestId("login-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("filters-modal")).toBeInTheDocument();
  });

  it("unmounts the child (wiping its internal state) when closed", () => {
    const registrations: ModalRegistrationMap = {
      BUG_REPORT: {
        render: () => <div data-testid="bug-report-body" />,
      },
    };

    function Harness() {
      const { openModal, closeModal } = useModal();
      return (
        <>
          <button onClick={() => openModal("BUG_REPORT")}>open</button>
          <button onClick={() => closeModal()}>close</button>
          <ModalRoot registrations={registrations} />
        </>
      );
    }

    render(withProvider(<Harness />));
    act(() => screen.getByRole("button", { name: /open/i }).click());
    expect(screen.getByTestId("bug-report-body")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: /close/i }).click());
    expect(screen.queryByTestId("bug-report-body")).not.toBeInTheDocument();
  });
});

// Sanity check the imports are not pruned.
void renderHook;

afterEach(() => cleanup());
