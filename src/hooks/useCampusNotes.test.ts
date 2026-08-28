// @vitest-environment jsdom
import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useCampusNotes } from "./useCampusNotes";

afterEach(() => { cleanup(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); });

describe("useCampusNotes", () => {
  it("initialises empty", () => {
    const { result } = renderHook(() => useCampusNotes());
    expect(result.current.notes).toHaveLength(0);
    expect(result.current.stats.totalNotes).toBe(0);
  });
  it("adds a note", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "Test Note", content: "Content here", category: "lecture", courseCode: "CS101", author: "Alice", tags: ["midterm"] }); });
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].title).toBe("Test Note");
    expect(result.current.notes[0].upvotes).toBe(0);
  });
  it("upvotes a note", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "T", content: "C", category: "other", courseCode: "", author: "", tags: [] }); });
    const id = result.current.notes[0].id;
    act(() => { result.current.upvoteNote(id); });
    act(() => { result.current.upvoteNote(id); });
    expect(result.current.notes[0].upvotes).toBe(2);
  });
  it("toggles bookmark", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "T", content: "C", category: "other", courseCode: "", author: "", tags: [] }); });
    const id = result.current.notes[0].id;
    act(() => { result.current.toggleBookmark(id); });
    expect(result.current.notes[0].isBookmarked).toBe(true);
    act(() => { result.current.toggleBookmark(id); });
    expect(result.current.notes[0].isBookmarked).toBe(false);
  });
  it("removes a note", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "T", content: "C", category: "other", courseCode: "", author: "", tags: [] }); });
    const id = result.current.notes[0].id;
    act(() => { result.current.removeNote(id); });
    expect(result.current.notes).toHaveLength(0);
  });
  it("searches notes", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "React Hooks", content: "useEffect explained", category: "lecture", courseCode: "CS201", author: "", tags: [] }); });
    act(() => { result.current.addNote({ title: "Python Basics", content: "loops and dicts", category: "study-tip", courseCode: "CS101", author: "", tags: [] }); });
    act(() => { result.current.setSearchTerm("hooks"); });
    expect(result.current.filteredNotes).toHaveLength(1);
    expect(result.current.filteredNotes[0].title).toBe("React Hooks");
  });
  it("persists to localStorage", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "Saved", content: "C", category: "other", courseCode: "", author: "", tags: [] }); });
    const stored = JSON.parse(localStorage.getItem("cc-campus-notes") ?? "[]");
    expect(stored).toHaveLength(1);
  });
  it("clears all data", () => {
    const { result } = renderHook(() => useCampusNotes());
    act(() => { result.current.addNote({ title: "X", content: "Y", category: "other", courseCode: "", author: "", tags: [] }); });
    act(() => { result.current.clearAllData(); });
    expect(result.current.notes).toHaveLength(0);
  });
});
