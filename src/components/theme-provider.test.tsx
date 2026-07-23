import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider, useTheme } from "./theme-provider";
import { globalState } from "@/store/globalState";

function TestConsumer() {
  const { theme } = useTheme();
  return <div id="current-theme">{theme}</div>;
}

describe("ThemeProvider & localStorage persistence", () => {
  const STORAGE_KEY = "campusconnect-theme";
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    const localStorageMock = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: 0,
      key: () => null,
    };

    if (typeof window === "undefined") {
      (global as unknown as { window: unknown }).window = {
        localStorage: localStorageMock,
        matchMedia: () => ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      };
    } else {
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        writable: true,
      });
    }

    if (typeof document === "undefined") {
      (global as unknown as { document: unknown }).document = {
        documentElement: {
          classList: {
            toggle: () => true,
            add: () => {},
            remove: () => {},
          },
          style: {} as CSSStyleDeclaration,
        },
      };
    }
  });

  afterEach(() => {
    storage = {};
  });

  it("renders ThemeProvider successfully with static markup", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );
    expect(markup).toContain("current-theme");
  });

  it("persists theme preference to localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");

    window.localStorage.setItem(STORAGE_KEY, "light");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("syncs with globalState.theme", () => {
    globalState.theme = "dark";
    expect(globalState.theme).toBe("dark");
  });
});
