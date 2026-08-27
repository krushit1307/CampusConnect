// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useReadingList } from "./useReadingList";

afterEach(() => { cleanup(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); });

describe("useReadingList", () => {
  it("initialises empty", () => {
    const { result } = renderHook(() => useReadingList());
    expect(result.current.books).toHaveLength(0);
    expect(result.current.stats.totalBooks).toBe(0);
  });

  it("adds a book", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => {
      result.current.addBook({ title: "Clean Code", author: "Robert Martin", category: "textbook", status: "to-read", totalPages: 464, currentPage: 0, rating: 0, notes: "" });
    });
    expect(result.current.books).toHaveLength(1);
    expect(result.current.books[0].title).toBe("Clean Code");
    expect(result.current.stats.booksToRead).toBe(1);
  });

  it("starts reading a book", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Test", author: "A", category: "novel", status: "to-read", totalPages: 200, currentPage: 0, rating: 0, notes: "" }); });
    const id = result.current.books[0].id;
    act(() => { result.current.startReading(id); });
    expect(result.current.books[0].status).toBe("reading");
    expect(result.current.books[0].dateStarted).not.toBeNull();
  });

  it("updates progress", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Test", author: "A", category: "other", status: "reading", totalPages: 100, currentPage: 0, rating: 0, notes: "" }); });
    const id = result.current.books[0].id;
    act(() => { result.current.updateProgress(id, 42); });
    expect(result.current.books[0].currentPage).toBe(42);
  });

  it("clamps progress to total pages", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Test", author: "A", category: "other", status: "reading", totalPages: 100, currentPage: 0, rating: 0, notes: "" }); });
    const id = result.current.books[0].id;
    act(() => { result.current.updateProgress(id, 200); });
    expect(result.current.books[0].currentPage).toBe(100);
  });

  it("finishes a book", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Test", author: "A", category: "other", status: "reading", totalPages: 100, currentPage: 50, rating: 0, notes: "" }); });
    const id = result.current.books[0].id;
    act(() => { result.current.finishBook(id, 4); });
    expect(result.current.books[0].status).toBe("finished");
    expect(result.current.books[0].currentPage).toBe(100);
    expect(result.current.books[0].rating).toBe(4);
    expect(result.current.stats.booksFinished).toBe(1);
  });

  it("removes a book", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Test", author: "A", category: "other", status: "to-read", totalPages: 100, currentPage: 0, rating: 0, notes: "" }); });
    const id = result.current.books[0].id;
    act(() => { result.current.removeBook(id); });
    expect(result.current.books).toHaveLength(0);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "Saved", author: "B", category: "novel", status: "to-read", totalPages: 300, currentPage: 0, rating: 0, notes: "" }); });
    const stored = JSON.parse(localStorage.getItem("cc-reading-list") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Saved");
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useReadingList());
    act(() => { result.current.addBook({ title: "X", author: "Y", category: "other", status: "to-read", totalPages: 100, currentPage: 0, rating: 0, notes: "" }); });
    act(() => { result.current.clearAllData(); });
    expect(result.current.books).toHaveLength(0);
  });
});
