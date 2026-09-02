import { useState, useCallback, useEffect, useMemo } from "react";

export type NoteCategory = "lecture" | "study-tip" | "exam-prep" | "resource" | "question" | "other";

export interface CampusNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  courseCode: string;
  author: string;
  tags: string[];
  upvotes: number;
  isBookmarked: boolean;
  datePosted: string;
}

export interface NotesStats {
  totalNotes: number;
  totalUpvotes: number;
  byCategory: { category: string; count: number }[];
  topCourse: string;
}

const CATEGORIES: Record<NoteCategory, { label: string; icon: string; color: string }> = {
  lecture: { label: "Lecture Notes", icon: "\u{1F4DD}", color: "text-blue-400" },
  "study-tip": { label: "Study Tip", icon: "\u{1F4A1}", color: "text-amber-400" },
  "exam-prep": { label: "Exam Prep", icon: "\u{1F393}", color: "text-red-400" },
  resource: { label: "Resource", icon: "\u{1F517}", color: "text-emerald-400" },
  question: { label: "Question", icon: "\u{2753}", color: "text-violet-400" },
  other: { label: "Other", icon: "\u{1F4CC}", color: "text-slate-400" },
};

const STORAGE_KEY = "cc-campus-notes";

function loadNotes(): CampusNote[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveNotes(notes: CampusNote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export interface UseCampusNotesReturn {
  notes: CampusNote[];
  filteredNotes: CampusNote[];
  stats: NotesStats;
  addNote: (data: Omit<CampusNote, "id" | "upvotes" | "isBookmarked" | "datePosted">) => void;
  removeNote: (id: string) => void;
  upvoteNote: (id: string) => void;
  toggleBookmark: (id: string) => void;
  clearAllData: () => void;
  categoryFilter: NoteCategory | "all";
  setCategoryFilter: (c: NoteCategory | "all") => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  sortBy: "recent" | "popular";
  setSortBy: (s: "recent" | "popular") => void;
  categories: typeof CATEGORIES;
}

export function useCampusNotes(): UseCampusNotesReturn {
  const [notes, setNotes] = useState<CampusNote[]>(loadNotes);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");

  useEffect(() => { saveNotes(notes); }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = [...notes];
    if (categoryFilter !== "all") result = result.filter((n) => n.category === categoryFilter);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      result = result.filter((n) => n.title.toLowerCase().includes(t) || n.content.toLowerCase().includes(t) || n.courseCode.toLowerCase().includes(t) || n.tags.some((tag) => tag.toLowerCase().includes(t)));
    }
    if (sortBy === "popular") {
      result.sort((a, b) => b.upvotes - a.upvotes);
    } else {
      result.sort((a, b) => new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime());
    }
    return result;
  }, [notes, categoryFilter, searchTerm, sortBy]);

  const stats = useMemo((): NotesStats => {
    const totalUpvotes = notes.reduce((s, n) => s + n.upvotes, 0);
    const catMap: Record<string, number> = {};
    const courseMap: Record<string, number> = {};
    notes.forEach((n) => {
      catMap[n.category] = (catMap[n.category] ?? 0) + 1;
      if (n.courseCode) courseMap[n.courseCode] = (courseMap[n.courseCode] ?? 0) + 1;
    });
    const topCourse = Object.entries(courseMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
    return {
      totalNotes: notes.length,
      totalUpvotes,
      byCategory: Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
      topCourse,
    };
  }, [notes]);

  const addNote = useCallback((data: Omit<CampusNote, "id" | "upvotes" | "isBookmarked" | "datePosted">) => {
    const newNote: CampusNote = { ...data, id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, upvotes: 0, isBookmarked: false, datePosted: new Date().toISOString() };
    setNotes((prev) => [newNote, ...prev]);
  }, []);

  const removeNote = useCallback((id: string) => { setNotes((prev) => prev.filter((n) => n.id !== id)); }, []);

  const upvoteNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, upvotes: n.upvotes + 1 } : n)));
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, isBookmarked: !n.isBookmarked } : n)));
  }, []);

  const clearAllData = useCallback(() => { setNotes([]); localStorage.removeItem(STORAGE_KEY); }, []);

  return { notes, filteredNotes, stats, addNote, removeNote, upvoteNote, toggleBookmark, clearAllData, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm, sortBy, setSortBy, categories: CATEGORIES };
}

export { CATEGORIES };
