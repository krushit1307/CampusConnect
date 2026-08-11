// src/hooks/useCartBroadcast.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCartBroadcast } from "./useCartBroadcast";

type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
  static instances: Record<string, MockBroadcastChannel[]> = {};
  name: string;
  handlers: MessageHandler[] = [];

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.instances[name]) {
      MockBroadcastChannel.instances[name] = [];
    }
    MockBroadcastChannel.instances[name].push(this);
  }

  postMessage(data: unknown) {
    const others = (MockBroadcastChannel.instances[this.name] ?? []).filter((ch) => ch !== this);
    for (const other of others) {
      for (const handler of other.handlers) {
        handler(new MessageEvent("message", { data }));
      }
    }
  }

  addEventListener(_type: string, handler: MessageHandler) {
    this.handlers.push(handler);
  }

  removeEventListener(_type: string, handler: MessageHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  close() {
    MockBroadcastChannel.instances[this.name] = (
      MockBroadcastChannel.instances[this.name] ?? []
    ).filter((ch) => ch !== this);
    this.handlers = [];
  }
}

describe("useCartBroadcast", () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = {};
    (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel =
      MockBroadcastChannel;
  });

  afterEach(() => {
    MockBroadcastChannel.instances = {};
  });

  it("starts with an empty cart", () => {
    const { result } = renderHook(() => useCartBroadcast());
    expect(result.current.cart).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("addItem adds a new item to the cart", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 2,
      }),
    );
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(20);
  });

  it("addItem increments quantity for an existing tier", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 2,
      }),
    );
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 1,
      }),
    );
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
    expect(result.current.totalItems).toBe(3);
  });

  it("removeItem removes an item by tierId", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 1,
      }),
    );
    act(() => result.current.removeItem("t1"));
    expect(result.current.cart).toEqual([]);
  });

  it("updateQuantity changes the quantity", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 1,
      }),
    );
    act(() => result.current.updateQuantity("t1", 5));
    expect(result.current.cart[0].quantity).toBe(5);
    expect(result.current.totalItems).toBe(5);
    expect(result.current.totalPrice).toBe(50);
  });

  it("updateQuantity with 0 removes the item", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 1,
      }),
    );
    act(() => result.current.updateQuantity("t1", 0));
    expect(result.current.cart).toEqual([]);
  });

  it("clearCart empties the cart", () => {
    const { result } = renderHook(() => useCartBroadcast());
    act(() =>
      result.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 3,
      }),
    );
    act(() => result.current.clearCart());
    expect(result.current.cart).toEqual([]);
  });

  it("syncs cart across two tabs", () => {
    const { result: tabA } = renderHook(() => useCartBroadcast());
    const { result: tabB } = renderHook(() => useCartBroadcast());

    act(() =>
      tabA.current.addItem({
        eventId: "e1",
        eventTitle: "Tech Talk",
        tierId: "t1",
        tierName: "General",
        price: 10,
        quantity: 2,
      }),
    );

    expect(tabA.current.cart).toHaveLength(1);
    expect(tabB.current.cart).toHaveLength(1);
    expect(tabB.current.cart[0].tierId).toBe("t1");
    expect(tabB.current.totalItems).toBe(2);
  });
});
