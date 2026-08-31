import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLaundryQueue } from "@/hooks/useLaundryQueue";
import type { DormZone, MachineType, CycleSize, QueuePriority } from "@/hooks/useLaundryQueue";

describe("useLaundryQueue", () => {
  it("should initialize with default state and mock data", () => {
    const { result } = renderHook(() => useLaundryQueue());

    expect(result.current.rooms.length).toBeGreaterThan(0);
    expect(result.current.machines.length).toBeGreaterThan(0);
    expect(result.current.queue.length).toBeGreaterThan(0);
    expect(result.current.notifications.length).toBeGreaterThan(0);
    expect(result.current.usageLogs.length).toBeGreaterThan(0);
    expect(result.current.zoneFilter).toBe("all");
    expect(result.current.machineTypeFilter).toBe("all");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.sortBy).toBe("wait-time");
    expect(result.current.viewMode).toBe("rooms");
  });

  it("should filter rooms by zone", () => {
    const { result } = renderHook(() => useLaundryQueue());

    act(() => {
      result.current.setZoneFilter("north");
    });

    expect(result.current.zoneFilter).toBe("north");
  });

  it("should filter rooms by search query", () => {
    const { result } = renderHook(() => useLaundryQueue());

    act(() => {
      result.current.setSearchQuery("Foster");
    });

    expect(result.current.searchQuery).toBe("Foster");
  });

  it("should join a laundry queue", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const initialQueueLength = result.current.queue.length;
    const roomId = result.current.rooms[0].id;

    act(() => {
      result.current.joinQueue(roomId, "washer", "medium", "normal");
    });

    expect(result.current.queue.length).toBe(initialQueueLength + 1);
    const newEntry = result.current.queue[result.current.queue.length - 1];
    expect(newEntry.roomId).toBe(roomId);
    expect(newEntry.machineType).toBe("washer");
    expect(newEntry.cycleSize).toBe("medium");
    expect(newEntry.userId).toBe("u-self");
    expect(newEntry.status).toBe("waiting");
  });

  it("should leave a queue", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const selfEntry = result.current.queue.find((q) => q.userId === "u-self");

    if (!selfEntry) return;

    act(() => {
      result.current.leaveQueue(selfEntry.id);
    });

    expect(result.current.queue.find((q) => q.id === selfEntry.id)).toBeUndefined();
  });

  it("should mark notification as read", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const unread = result.current.notifications.find((n) => !n.read);

    if (!unread) return;

    act(() => {
      result.current.markNotificationRead(unread.id);
    });

    const updated = result.current.notifications.find((n) => n.id === unread.id);
    expect(updated?.read).toBe(true);
  });

  it("should clear all notifications", () => {
    const { result } = renderHook(() => useLaundryQueue());

    act(() => {
      result.current.clearNotifications();
    });

    result.current.notifications.forEach((n) => {
      expect(n.read).toBe(true);
    });
  });

  it("should rate a room", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const room = result.current.rooms[0];
    const initialRating = room.rating;
    const initialTotal = room.totalRatings;

    act(() => {
      result.current.rateRoom(room.id, 5);
    });

    const updated = result.current.rooms.find((r) => r.id === room.id);
    expect(updated?.totalRatings).toBe(initialTotal + 1);
    expect(updated?.avgRating).toBeGreaterThanOrEqual(initialRating);
  });

  it("should get machines for a specific room", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const roomId = result.current.rooms[0].id;

    const roomMachines = result.current.getRoomMachines(roomId);
    expect(roomMachines.length).toBeGreaterThan(0);
    roomMachines.forEach((m) => {
      expect(m.roomId).toBe(roomId);
    });
  });

  it("should get available machines", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const roomId = result.current.rooms[0].id;

    const available = result.current.getAvailableMachines(roomId, "washer");
    expect(Array.isArray(available)).toBe(true);
    available.forEach((m) => {
      expect(m.status).toBe("available");
      expect(m.type).toBe("washer");
    });
  });

  it("should compute stats correctly", () => {
    const { result } = renderHook(() => useLaundryQueue());

    expect(result.current.stats.totalLoads).toBe(result.current.usageLogs.length);
    expect(result.current.stats.totalMinutes).toBeGreaterThan(0);
    expect(result.current.stats.totalCost).toBeGreaterThan(0);
    expect(result.current.stats.totalSavings).toBeGreaterThan(0);
    expect(result.current.stats.streakDays).toBeGreaterThanOrEqual(0);
  });

  it("should return peak hours data", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const peakHours = result.current.getPeakHours();

    expect(Array.isArray(peakHours)).toBe(true);
    expect(peakHours.length).toBe(18); // 6 AM to 11 PM
    peakHours.forEach((ph) => {
      expect(ph.hour).toBeTruthy();
      expect(ph.load).toBeGreaterThanOrEqual(0);
    });
  });

  it("should return recommendations", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const recs = result.current.getRecommendations();

    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeLessThanOrEqual(3);
    recs.forEach((r) => {
      expect(r.isOpen).toBe(true);
    });
  });

  it("should get upcoming available machines", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const roomId = result.current.rooms[0].id;

    const upcoming = result.current.getUpcomingAvailable(roomId, "washer");
    expect(Array.isArray(upcoming)).toBe(true);
    upcoming.forEach((entry) => {
      expect(entry.machine).toBeDefined();
      expect(entry.availableAt).toBeTruthy();
    });
  });

  it("should compute queue position", () => {
    const { result } = renderHook(() => useLaundryQueue());
    const selfEntry = result.current.queue.find((q) => q.userId === "u-self");

    if (!selfEntry) return;

    const position = result.current.getQueuePosition(selfEntry.id);
    expect(typeof position).toBe("number");
    expect(position).toBeGreaterThan(0);
  });
});
