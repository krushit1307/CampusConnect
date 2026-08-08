import { vi, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { toHaveNoViolations } from "jest-axe";

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers);

// Extend Vitest with jest-axe custom matcher
expect.extend(toHaveNoViolations);
import "@testing-library/jest-dom/vitest";
import React from "react";

process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

vi.mock("tailwind-merge", () => ({
  twMerge: (...args: string[]) => args.filter(Boolean).join(" "),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Polyfill ResizeObserver for Radix UI tooltip/popover tests in jsdom (#1758)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Mock lucide-react using importOriginal so that ALL icons are available
// in tests without enumerating them one by one.
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
  };
});
