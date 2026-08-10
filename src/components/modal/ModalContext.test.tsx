import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ModalProvider, useModal } from "./ModalContext";

function wrapper({ children }: { children: ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}

describe("useModal — initial state (issue #1916)", () => {
  it("starts with no active modal", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    expect(result.current.activeModal).toBeNull();
    expect(result.current.modalProps).toBeUndefined();
  });

  it("isOpen('LOGIN') returns false at rest", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    expect(result.current.isOpen("LOGIN")).toBe(false);
  });
});

describe("useModal — openModal (issue #1916)", () => {
  it("opens a modal with no props", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    act(() => result.current.openModal("BUG_REPORT"));
    expect(result.current.activeModal).toBe("BUG_REPORT");
    expect(result.current.modalProps).toBeUndefined();
    expect(result.current.isOpen("BUG_REPORT")).toBe(true);
  });

  it("opens a modal with typed props", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    act(() => result.current.openModal("SHARE", { url: "https://example.com" }));
    expect(result.current.activeModal).toBe("SHARE");
    expect(result.current.modalProps).toEqual({ url: "https://example.com" });
  });

  it("opens a modal with optional query string", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    act(() => result.current.openModal("COMMAND_PALETTE", { initialQuery: "go" }));
    expect(result.current.modalProps).toEqual({ initialQuery: "go" });
  });

  it("REPLACES an already-active modal — only one at a time", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    act(() => result.current.openModal("LOGIN"));
    act(() => result.current.openModal("FILTERS", { clubId: "abc" }));
    // The previous LOGIN is gone; only FILTERS is active.
    expect(result.current.activeModal).toBe("FILTERS");
    expect(result.current.isOpen("LOGIN")).toBe(false);
    expect(result.current.isOpen("FILTERS")).toBe(true);
  });
});

describe("useModal — closeModal (issue #1916)", () => {
  it("closes the active modal", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    act(() => result.current.openModal("LOGIN", { redirectTo: "/feed" }));
    act(() => result.current.closeModal());
    expect(result.current.activeModal).toBeNull();
    expect(result.current.modalProps).toBeUndefined();
    expect(result.current.isOpen("LOGIN")).toBe(false);
  });

  it("is a no-op when no modal is active", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    // Calling closeModal() at rest should not throw or change state.
    act(() => result.current.closeModal());
    expect(result.current.activeModal).toBeNull();
  });
});

describe("useModal — provider guard (issue #1916)", () => {
  it("throws when used outside a <ModalProvider>", () => {
    // Suppress React's error boundary log for the expected throw.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useModal())).toThrow(/ModalProvider/);
    errSpy.mockRestore();
  });
});

describe("useModal — callback stability (issue #1916)", () => {
  it("keeps openModal/closeModal/isOpen referentially stable across renders", () => {
    const { result, rerender } = renderHook(() => useModal(), { wrapper });
    const open1 = result.current.openModal;
    const close1 = result.current.closeModal;
    const isOpen1 = result.current.isOpen;
    rerender();
    expect(result.current.openModal).toBe(open1);
    expect(result.current.closeModal).toBe(close1);
    expect(result.current.isOpen).toBe(isOpen1);
  });

  it("updates isOpen when activeModal changes", () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    expect(result.current.isOpen("LOGIN")).toBe(false);
    act(() => result.current.openModal("LOGIN"));
    expect(result.current.isOpen("LOGIN")).toBe(true);
    act(() => result.current.closeModal());
    expect(result.current.isOpen("LOGIN")).toBe(false);
  });
});
