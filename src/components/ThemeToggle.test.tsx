import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, beforeEach } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./ThemeToggle";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("ThemeToggle", () => {
  beforeEach(() => {
    let storage: Record<string, string> = {};
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

  it("renders ThemeToggle with accessibility attributes and theme provider context", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <TooltipProvider>
          <ThemeToggle />
        </TooltipProvider>
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Current theme:');
    expect(markup).toContain('type="button"');
  });
});
