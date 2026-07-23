import { describe, it, expect, vi } from "vitest";
import { createSignal, createEffect, createReactiveObject, bindSignalToDOM } from "./signals";

describe("createSignal and createEffect", () => {
  it("initializes with the given value", () => {
    const [count] = createSignal(10);
    expect(count()).toBe(10);
    expect(count.value).toBe(10);
    expect(count.peek()).toBe(10);
  });

  it("updates value and notifies effect when updated via setter", () => {
    const [count, setCount] = createSignal(0);
    const fn = vi.fn();

    createEffect(() => {
      fn(count());
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(0);

    setCount(5);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(5);
  });

  it("supports functional setter updates", () => {
    const [count, setCount] = createSignal(1);
    setCount((prev) => prev + 10);
    expect(count()).toBe(11);
  });

  it("supports updates via property setter count.value =", () => {
    const [count] = createSignal("hello");
    const fn = vi.fn();

    createEffect(() => {
      fn(count.value);
    });

    expect(fn).toHaveBeenLastCalledWith("hello");

    count.value = "world";
    expect(fn).toHaveBeenLastCalledWith("world");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not trigger effects when peek() is used", () => {
    const [count, setCount] = createSignal(0);
    const fn = vi.fn();

    createEffect(() => {
      fn(count.peek());
    });

    expect(fn).toHaveBeenCalledTimes(1);

    setCount(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows unsubscribe cleanup from createEffect", () => {
    const [count, setCount] = createSignal(0);
    const fn = vi.fn();

    const unsubscribe = createEffect(() => {
      fn(count());
    });

    expect(fn).toHaveBeenCalledTimes(1);

    setCount(1);
    expect(fn).toHaveBeenCalledTimes(2);

    unsubscribe();

    setCount(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("runs returned cleanup function before re-running effect", () => {
    const [count, setCount] = createSignal(0);
    const cleanupFn = vi.fn();

    createEffect(() => {
      count();
      return cleanupFn;
    });

    expect(cleanupFn).toHaveBeenCalledTimes(0);

    setCount(1);
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    setCount(2);
    expect(cleanupFn).toHaveBeenCalledTimes(2);
  });

  it("supports manual subscription via signal.subscribe", () => {
    const [name, setName] = createSignal("Alice");
    const listener = vi.fn();

    const unsubscribe = name.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();

    setName("Bob");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith("Bob");

    unsubscribe();
    setName("Charlie");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("createReactiveObject with JS Proxy", () => {
  it("tracks fine-grained property reads and triggers on updates", () => {
    const state = createReactiveObject({
      user: { name: "John" },
      theme: "light",
    });

    const nameFn = vi.fn();
    const themeFn = vi.fn();

    createEffect(() => {
      nameFn(state.user.name);
    });

    createEffect(() => {
      themeFn(state.theme);
    });

    expect(nameFn).toHaveBeenLastCalledWith("John");
    expect(themeFn).toHaveBeenLastCalledWith("light");

    state.theme = "dark";
    expect(themeFn).toHaveBeenLastCalledWith("dark");
    expect(themeFn).toHaveBeenCalledTimes(2);
    expect(nameFn).toHaveBeenCalledTimes(1); // nameFn should NOT re-run!

    state.user.name = "Jane";
    expect(nameFn).toHaveBeenLastCalledWith("Jane");
    expect(nameFn).toHaveBeenCalledTimes(2);
    expect(themeFn).toHaveBeenCalledTimes(2); // themeFn should NOT re-run!
  });
});

describe("bindSignalToDOM for React render cycle bypassing", () => {
  it("directly mutates HTMLElement textContent without React re-render", () => {
    const [text, setText] = createSignal("Initial Text");
    const div = { nodeType: 1, textContent: "" } as unknown as HTMLElement;

    const cleanup = bindSignalToDOM(div, text);
    expect(div.textContent).toBe("Initial Text");

    setText("Updated Text");
    expect(div.textContent).toBe("Updated Text");

    cleanup();
    setText("After Cleanup");
    expect(div.textContent).toBe("Updated Text");
  });

  it("directly mutates DOM Text node nodeValue", () => {
    const [count, setCount] = createSignal(100);
    const textNode = { nodeType: 3, nodeValue: "" } as unknown as Text;

    bindSignalToDOM(textNode, count);
    expect(textNode.nodeValue).toBe("100");

    setCount(200);
    expect(textNode.nodeValue).toBe("200");
  });
});
