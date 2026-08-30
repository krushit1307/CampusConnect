import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudyGroupFinder } from "@/hooks/useStudyGroupFinder";
import type { StudyGroup, StudySubject, StudyGroupStatus } from "@/hooks/useStudyGroupFinder";

describe("useStudyGroupFinder", () => {
  it("should initialize with default state and mock data", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    expect(result.current.groups.length).toBeGreaterThan(0);
    expect(result.current.filteredGroups.length).toBeGreaterThan(0);
    expect(result.current.resources.length).toBeGreaterThan(0);
    expect(result.current.subjectFilter).toBe("all");
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.sortBy).toBe("relevance");
    expect(result.current.viewMode).toBe("grid");
  });

  it("should filter groups by subject", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    act(() => {
      result.current.setSubjectFilter("cs");
    });

    expect(result.current.subjectFilter).toBe("cs");
    result.current.filteredGroups.forEach((g) => {
      expect(g.subject).toBe("cs");
    });
  });

  it("should filter groups by status", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    act(() => {
      result.current.setStatusFilter("active");
    });

    expect(result.current.statusFilter).toBe("active");
    result.current.filteredGroups.forEach((g) => {
      expect(g.status).toBe("active");
    });
  });

  it("should filter groups by search query", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    act(() => {
      result.current.setSearchQuery("Calculus");
    });

    expect(result.current.searchQuery).toBe("Calculus");
    expect(result.current.filteredGroups.length).toBeGreaterThan(0);
    result.current.filteredGroups.forEach((g) => {
      const q = "calculus";
      const matchesName = g.name.toLowerCase().includes(q);
      const matchesCourse = g.course.toLowerCase().includes(q);
      const matchesCode = g.courseCode.toLowerCase().includes(q);
      const matchesDesc = g.description.toLowerCase().includes(q);
      const matchesTags = g.tags.some((t) => t.toLowerCase().includes(q));
      expect(matchesName || matchesCourse || matchesCode || matchesDesc || matchesTags).toBe(true);
    });
  });

  it("should join a group", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const joinableGroup = result.current.groups.find((g) => !g.isJoined && g.status !== "full");

    if (!joinableGroup) return;

    act(() => {
      result.current.joinGroup(joinableGroup.id);
    });

    const updated = result.current.groups.find((g) => g.id === joinableGroup.id);
    expect(updated?.isJoined).toBe(true);
    expect(updated?.currentMembers).toBe(joinableGroup.currentMembers + 1);
  });

  it("should leave a group", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const joinedGroup = result.current.groups.find((g) => g.isJoined);

    if (!joinedGroup) return;

    act(() => {
      result.current.leaveGroup(joinedGroup.id);
    });

    const updated = result.current.groups.find((g) => g.id === joinedGroup.id);
    expect(updated?.isJoined).toBe(false);
    expect(updated?.currentMembers).toBe(joinedGroup.currentMembers - 1);
  });

  it("should send a message to a group", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const joinedGroup = result.current.groups.find((g) => g.isJoined);

    if (!joinedGroup) return;

    const initialMsgCount = joinedGroup.messages.length;

    act(() => {
      result.current.sendMessage(joinedGroup.id, "Hello, study buddies!");
    });

    const updated = result.current.groups.find((g) => g.id === joinedGroup.id);
    expect(updated?.messages.length).toBe(initialMsgCount + 1);
    expect(updated?.messages[updated.messages.length - 1].content).toBe("Hello, study buddies!");
  });

  it("should rate a group", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const group = result.current.groups[0];

    const initialRating = group.avgRating;
    const initialTotal = group.totalRatings;

    act(() => {
      result.current.rateGroup(group.id, 5);
    });

    const updated = result.current.groups.find((g) => g.id === group.id);
    expect(updated?.totalRatings).toBe(initialTotal + 1);
    expect(updated?.avgRating).toBeGreaterThanOrEqual(initialRating);
  });

  it("should create a new group", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const initialCount = result.current.groups.length;

    act(() => {
      result.current.createGroup({
        name: "Test Study Group",
        subject: "math",
        course: "Test Course",
        courseCode: "TEST 101",
      });
    });

    expect(result.current.groups.length).toBe(initialCount + 1);
    const newGroup = result.current.groups[0];
    expect(newGroup.name).toBe("Test Study Group");
    expect(newGroup.isJoined).toBe(true);
    expect(newGroup.isOwner).toBe(true);
  });

  it("should compute stats correctly", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    expect(result.current.stats.totalGroups).toBe(result.current.groups.length);
    expect(result.current.stats.joinedGroups).toBe(
      result.current.groups.filter((g) => g.isJoined).length,
    );
    expect(result.current.stats.studyHours).toBeGreaterThanOrEqual(0);
    expect(result.current.stats.peerConnections).toBeGreaterThanOrEqual(0);
  });

  it("should return recommended groups", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const recommended = result.current.getRecommendedGroups();

    expect(Array.isArray(recommended)).toBe(true);
    recommended.forEach((g) => {
      expect(g.isJoined).toBe(false);
      expect(g.status).not.toBe("full");
    });
  });

  it("should find a group by ID", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const firstGroup = result.current.groups[0];

    const found = result.current.getGroupById(firstGroup.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(firstGroup.id);
  });

  it("should return groups by subject", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const csGroups = result.current.getGroupsBySubject("cs");

    expect(Array.isArray(csGroups)).toBe(true);
    csGroups.forEach((g) => {
      expect(g.subject).toBe("cs");
    });
  });

  it("should sort groups correctly", () => {
    const { result } = renderHook(() => useStudyGroupFinder());

    act(() => {
      result.current.setSortBy("rating");
    });

    const groups = result.current.filteredGroups;
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].avgRating).toBeGreaterThanOrEqual(groups[i].avgRating);
    }
  });

  it("should compute study streak", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const streak = result.current.getStudyStreak();
    expect(typeof streak).toBe("number");
    expect(streak).toBeGreaterThanOrEqual(0);
  });

  it("should get upcoming sessions", () => {
    const { result } = renderHook(() => useStudyGroupFinder());
    const sessions = result.current.getUpcomingSessions();

    expect(Array.isArray(sessions)).toBe(true);
    sessions.forEach((entry) => {
      expect(entry.group).toBeDefined();
      expect(entry.session).toBeDefined();
      expect(entry.session.groupId).toBe(entry.group.id);
    });
  });
});
