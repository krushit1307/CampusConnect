// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useEmergencyContacts } from "./useEmergencyContacts";

afterEach(() => { cleanup(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); });

describe("useEmergencyContacts", () => {
  it("initialises with default contacts", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    expect(result.current.contacts.length).toBeGreaterThan(0);
    expect(result.current.stats.total).toBeGreaterThan(0);
  });

  it("adds a custom contact", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    const before = result.current.contacts.length;
    act(() => {
      result.current.addContact({
        name: "Library", category: "academic", phone: "555-1234",
        email: "lib@campus.edu", location: "Main Library", hours: "24/7",
        description: "Study spaces", isFavorite: false, isPinned: false, isCustom: true,
      });
    });
    expect(result.current.contacts.length).toBe(before + 1);
  });

  it("toggles favorite", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    const id = result.current.contacts[0].id;
    act(() => { result.current.toggleFavorite(id); });
    expect(result.current.contacts[0].isFavorite).toBe(true);
    act(() => { result.current.toggleFavorite(id); });
    expect(result.current.contacts[0].isFavorite).toBe(false);
  });

  it("toggles pinned", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    const id = result.current.contacts[0].id;
    act(() => { result.current.togglePinned(id); });
    expect(result.current.contacts[0].isPinned).toBe(true);
  });

  it("removes a custom contact", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    act(() => {
      result.current.addContact({
        name: "Test", category: "other", phone: "555-0000",
        email: "", location: "", hours: "", description: "",
        isFavorite: false, isPinned: false, isCustom: true,
      });
    });
    const id = result.current.contacts[0].id;
    act(() => { result.current.removeContact(id); });
    expect(result.current.contacts.find((c) => c.id === id)).toBeUndefined();
  });

  it("filters by category", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    act(() => { result.current.setCategoryFilter("emergency"); });
    expect(result.current.filteredContacts.every((c) => c.category === "emergency")).toBe(true);
  });

  it("searches contacts", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    act(() => { result.current.setSearchTerm("police"); });
    expect(result.current.filteredContacts.length).toBeGreaterThan(0);
    expect(result.current.filteredContacts[0].name.toLowerCase()).toContain("police");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    act(() => {
      result.current.addContact({
        name: "Saved", category: "other", phone: "555-9999",
        email: "", location: "", hours: "", description: "",
        isFavorite: false, isPinned: false, isCustom: true,
      });
    });
    const stored = JSON.parse(localStorage.getItem("cc-emergency-contacts") ?? "[]");
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.some((c: { name: string }) => c.name === "Saved")).toBe(true);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useEmergencyContacts());
    act(() => { result.current.clearAllData(); });
    expect(result.current.contacts).toHaveLength(0);
  });
});
