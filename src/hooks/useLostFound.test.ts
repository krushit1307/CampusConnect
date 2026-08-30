// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useLostFound } from "./useLostFound";

afterEach(() => { cleanup(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); });

describe("useLostFound", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useLostFound());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.stats.totalItems).toBe(0);
  });

  it("adds an item", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Lost Keys",
        description: "Silver keys with a red keychain",
        category: "keys",
        status: "lost",
        location: "Library",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "John",
        contactInfo: "john@campus.edu",
        reward: "",
        imageUrl: "",
      });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe("Lost Keys");
    expect(result.current.items[0].upvotes).toBe(0);
  });

  it("upvotes an item", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Found Wallet",
        description: "",
        category: "bags",
        status: "found",
        location: "Cafeteria",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "Jane",
        contactInfo: "",
        reward: "",
        imageUrl: "",
      });
    });
    const id = result.current.items[0].id;
    act(() => { result.current.upvoteItem(id); });
    act(() => { result.current.upvoteItem(id); });
    expect(result.current.items[0].upvotes).toBe(2);
  });

  it("claims a found item", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Found Laptop",
        description: "",
        category: "electronics",
        status: "found",
        location: "CS Building",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "Bob",
        contactInfo: "",
        reward: "",
        imageUrl: "",
      });
    });
    const id = result.current.items[0].id;
    act(() => { result.current.claimItem(id); });
    expect(result.current.items[0].status).toBe("claimed");
    expect(result.current.stats.claimedItems).toBe(1);
  });

  it("removes an item", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Test",
        description: "",
        category: "other",
        status: "lost",
        location: "",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "",
        contactInfo: "",
        reward: "",
        imageUrl: "",
      });
    });
    const id = result.current.items[0].id;
    act(() => { result.current.removeItem(id); });
    expect(result.current.items).toHaveLength(0);
  });

  it("filters by status", () => {
    const { result } = renderHook(() => useLostFound());
    const now = new Date().toISOString();
    act(() => { result.current.addItem({ title: "Lost", description: "", category: "other", status: "lost", location: "", dateReported: now, dateLostOrFound: now, contactName: "", contactInfo: "", reward: "", imageUrl: "" }); });
    act(() => { result.current.addItem({ title: "Found", description: "", category: "other", status: "found", location: "", dateReported: now, dateLostOrFound: now, contactName: "", contactInfo: "", reward: "", imageUrl: "" }); });
    act(() => { result.current.setStatusFilter("lost"); });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].status).toBe("lost");
  });

  it("searches items", () => {
    const { result } = renderHook(() => useLostFound());
    const now = new Date().toISOString();
    act(() => { result.current.addItem({ title: "Blue Phone", description: "iPhone", category: "electronics", status: "lost", location: "Library", dateReported: now, dateLostOrFound: now, contactName: "", contactInfo: "", reward: "", imageUrl: "" }); });
    act(() => { result.current.addItem({ title: "Red Jacket", description: "North Face", category: "clothing", status: "found", location: "Gym", dateReported: now, dateLostOrFound: now, contactName: "", contactInfo: "", reward: "", imageUrl: "" }); });
    act(() => { result.current.setSearchTerm("phone"); });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].title).toBe("Blue Phone");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Saved Item",
        description: "",
        category: "books",
        status: "lost",
        location: "",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "",
        contactInfo: "",
        reward: "",
        imageUrl: "",
      });
    });
    const stored = JSON.parse(localStorage.getItem("cc-lost-found") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Saved Item");
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useLostFound());
    act(() => {
      result.current.addItem({
        title: "Test",
        description: "",
        category: "other",
        status: "lost",
        location: "",
        dateReported: new Date().toISOString(),
        dateLostOrFound: new Date().toISOString(),
        contactName: "",
        contactInfo: "",
        reward: "",
        imageUrl: "",
      });
    });
    act(() => { result.current.clearAllData(); });
    expect(result.current.items).toHaveLength(0);
  });
});
