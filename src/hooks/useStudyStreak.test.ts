// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useStudyStreak } from "./useStudyStreak";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe("useStudyStreak", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useStudyStreak());

    expect(result.current.stats.currentStreak).toBe(0);
    expect(result.current.stats.longestStreak).toBe(0);
    expect(result.current.stats.totalDaysStudied).toBe(0);
    expect(result.current.stats.totalMinutes).toBe(0);
    expect(result.current.heatmapData).toHaveLength(180);
  });

  it("logs a study session and updates stats", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(30);
    });

    expect(result.current.stats.totalMinutes).toBe(30);
    expect(result.current.stats.totalSessions).toBe(1);
    expect(result.current.stats.totalDaysStudied).toBe(1);
  });

  it("accumulates multiple sessions on the same day", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(25);
    });

    act(() => {
      result.current.logStudySession(35);
    });

    expect(result.current.stats.totalMinutes).toBe(60);
    expect(result.current.stats.totalSessions).toBe(2);
    expect(result.current.stats.totalDaysStudied).toBe(1);
  });

  it("persists data in localStorage", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(45);
    });

    const stored = JSON.parse(localStorage.getItem("cc-study-streak") ?? "{}");
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    expect(stored[todayKey]).toBeDefined();
    expect(stored[todayKey].minutes).toBe(45);
    expect(stored[todayKey].sessions).toBe(1);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(30);
    });

    expect(result.current.stats.totalMinutes).toBe(30);

    act(() => {
      result.current.clearAllData();
    });

    expect(result.current.stats.totalMinutes).toBe(0);
    expect(result.current.stats.totalDaysStudied).toBe(0);
  });

  it("getDayMinutes returns correct value", () => {
    const { result } = renderHook(() => useStudyStreak());

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    expect(result.current.getDayMinutes(todayKey)).toBe(0);

    act(() => {
      result.current.logStudySession(20);
    });

    expect(result.current.getDayMinutes(todayKey)).toBe(20);
  });

  it("heatmap data has correct levels", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(15);
    });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const todayHeatmap = result.current.heatmapData.find((d) => d.date === todayKey);
    expect(todayHeatmap).toBeDefined();
    expect(todayHeatmap!.level).toBe(1); // 15 min = level 1
    expect(todayHeatmap!.minutes).toBe(15);
  });

  it("computes average minutes per day", () => {
    const { result } = renderHook(() => useStudyStreak());

    act(() => {
      result.current.logStudySession(60);
    });

    act(() => {
      result.current.logStudySession(30);
    });

    // Both sessions on same day, so avg = 90 / 1 = 90
    expect(result.current.stats.averageMinutesPerDay).toBe(90);
  });
});
