// @vitest-environment jsdom

import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import {
  CommandPaletteProvider,
  useCommand,
  useCommandPalette,
  type CommandObj,
} from "./CommandPaletteProvider";

expect.extend(matchers);

let observed: CommandObj[] = [];

function Probe() {
  const { commands } = useCommandPalette();
  observed = commands;
  return null;
}

beforeEach(() => {
  observed = [];
});

afterEach(() => {
  cleanup();
});

describe("useCommand", () => {
  it("registers a command while mounted and unregisters it on unmount", () => {
    function Mounted() {
      useCommand({ id: "cmd-1", title: "One", action: () => {} });
      return null;
    }

    const { rerender } = render(
      <CommandPaletteProvider>
        <Probe />
        <Mounted />
      </CommandPaletteProvider>,
    );

    expect(observed.map((c) => c.id)).toEqual(["cmd-1"]);

    rerender(
      <CommandPaletteProvider>
        <Probe />
      </CommandPaletteProvider>,
    );

    expect(observed).toEqual([]);
  });

  it("invokes the latest action closure to avoid stale closures", () => {
    const executed: number[] = [];

    function Counter({ value }: { value: number }) {
      useCommand({
        id: "cmd-count",
        title: "Count",
        action: () => executed.push(value),
      });
      return null;
    }

    const { rerender } = render(
      <CommandPaletteProvider>
        <Probe />
        <Counter value={1} />
      </CommandPaletteProvider>,
    );

    let command = observed.find((c) => c.id === "cmd-count")!;
    command.action();
    expect(executed).toEqual([1]);

    // Re-render with a new value; the registered action must now target value 2.
    rerender(
      <CommandPaletteProvider>
        <Probe />
        <Counter value={2} />
      </CommandPaletteProvider>,
    );

    command = observed.find((c) => c.id === "cmd-count")!;
    command.action();
    expect(executed).toEqual([1, 2]);
  });

  it("does not register anything when passed null", () => {
    function Nullable() {
      useCommand(null);
      return null;
    }

    render(
      <CommandPaletteProvider>
        <Probe />
        <Nullable />
      </CommandPaletteProvider>,
    );

    expect(observed).toEqual([]);
  });

  it("replaces an existing command with the same id instead of duplicating it", () => {
    function Duplicate() {
      useCommand({ id: "dup", title: "First", action: () => {} });
      useCommand({ id: "dup", title: "Second", action: () => {} });
      return null;
    }

    render(
      <CommandPaletteProvider>
        <Probe />
        <Duplicate />
      </CommandPaletteProvider>,
    );

    expect(observed.filter((c) => c.id === "dup")).toHaveLength(1);
    expect(observed.find((c) => c.id === "dup")?.title).toBe("Second");
  });
});
