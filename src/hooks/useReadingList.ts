import { useState, useCallback, useEffect, useMemo } from "react";

export type BookStatus = "to-read" | "reading" | "finished" | "abandoned";
export type BookCategory = "textbook" | "novel" | "research" | "self-help" | "reference" | "other";

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  status: BookStatus;
  totalPages: number;
  currentPage: number;
  rating: number; // 1-5 stars, 0 = unrated
  notes: string;
  dateAdded: string;
  dateStarted: string | null;
  dateFinished: string | null;
}

export interface ReadingStats {
  totalBooks: number;
  booksReading: number;
  booksFinished: number;
  booksToRead: number;
  totalPagesRead: number;
  totalPagesPlanned: number;
  averageRating: number;
  currentBookTitle: string | null;
  currentBookProgress: number;
}

const CATEGORIES: Record<BookCategory, { label: string; icon: string }> = {
  textbook: { label: "Textbook", icon: "\u{1F4DA}" },
  novel: { label: "Novel", icon: "\u{1F4D6}" },
  research: { label: "Research", icon: "\u{1F50D}" },
  "self-help": { label: "Self-Help", icon: "\u{1F31F}" },
  reference: { label: "Reference", icon: "\u{1F4D1}" },
  other: { label: "Other", icon: "\u{1F4CC}" },
};

const STORAGE_KEY = "cc-reading-list";

function loadBooks(): Book[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveBooks(books: Book[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export interface UseReadingListReturn {
  books: Book[];
  filteredBooks: Book[];
  stats: ReadingStats;
  addBook: (data: Omit<Book, "id" | "dateAdded" | "dateStarted" | "dateFinished">) => void;
  removeBook: (id: string) => void;
  updateBook: (id: string, patch: Partial<Omit<Book, "id">>) => void;
  startReading: (id: string) => void;
  updateProgress: (id: string, currentPage: number) => void;
  finishBook: (id: string, rating: number) => void;
  abandonBook: (id: string) => void;
  rateBook: (id: string, rating: number) => void;
  clearAllData: () => void;
  statusFilter: BookStatus | "all";
  setStatusFilter: (s: BookStatus | "all") => void;
  categoryFilter: BookCategory | "all";
  setCategoryFilter: (c: BookCategory | "all") => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  categories: typeof CATEGORIES;
}

export function useReadingList(): UseReadingListReturn {
  const [books, setBooks] = useState<Book[]>(loadBooks);
  const [statusFilter, setStatusFilter] = useState<BookStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<BookCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { saveBooks(books); }, [books]);

  const filteredBooks = useMemo(() => {
    let result = [...books];
    if (statusFilter !== "all") result = result.filter((b) => b.status === statusFilter);
    if (categoryFilter !== "all") result = result.filter((b) => b.category === categoryFilter);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t));
    }
    // Sort: reading first, then to-read, then finished, then abandoned
    const statusOrder: Record<BookStatus, number> = { reading: 0, "to-read": 1, finished: 2, abandoned: 3 };
    result.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.currentPage - a.currentPage);
    return result;
  }, [books, statusFilter, categoryFilter, searchTerm]);

  const stats = useMemo((): ReadingStats => {
    const reading = books.filter((b) => b.status === "reading");
    const finished = books.filter((b) => b.status === "finished");
    const toRead = books.filter((b) => b.status === "to-read");
    const currentBook = reading[0];
    const totalPagesRead = books.reduce((s, b) => s + b.currentPage, 0);
    const totalPagesPlanned = books.reduce((s, b) => s + b.totalPages, 0);
    const rated = books.filter((b) => b.rating > 0);
    return {
      totalBooks: books.length,
      booksReading: reading.length,
      booksFinished: finished.length,
      booksToRead: toRead.length,
      totalPagesRead,
      totalPagesPlanned,
      averageRating: rated.length > 0 ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0,
      currentBookTitle: currentBook?.title ?? null,
      currentBookProgress: currentBook && currentBook.totalPages > 0 ? Math.round((currentBook.currentPage / currentBook.totalPages) * 100) : 0,
    };
  }, [books]);

  const addBook = useCallback((data: Omit<Book, "id" | "dateAdded" | "dateStarted" | "dateFinished">) => {
    const newBook: Book = { ...data, id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dateAdded: new Date().toISOString(), dateStarted: null, dateFinished: null };
    setBooks((prev) => [...prev, newBook]);
  }, []);

  const removeBook = useCallback((id: string) => { setBooks((prev) => prev.filter((b) => b.id !== id)); }, []);

  const updateBook = useCallback((id: string, patch: Partial<Omit<Book, "id">>) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const startReading = useCallback((id: string) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status: "reading" as BookStatus, dateStarted: b.dateStarted ?? new Date().toISOString() } : b)));
  }, []);

  const updateProgress = useCallback((id: string, currentPage: number) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, currentPage: Math.min(currentPage, b.totalPages) } : b)));
  }, []);

  const finishBook = useCallback((id: string, rating: number) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status: "finished" as BookStatus, currentPage: b.totalPages, dateFinished: new Date().toISOString(), rating } : b)));
  }, []);

  const abandonBook = useCallback((id: string) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status: "abandoned" as BookStatus } : b)));
  }, []);

  const rateBook = useCallback((id: string, rating: number) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, rating } : b)));
  }, []);

  const clearAllData = useCallback(() => { setBooks([]); localStorage.removeItem(STORAGE_KEY); }, []);

  return { books, filteredBooks, stats, addBook, removeBook, updateBook, startReading, updateProgress, finishBook, abandonBook, rateBook, clearAllData, statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm, categories: CATEGORIES };
}

export { CATEGORIES };
