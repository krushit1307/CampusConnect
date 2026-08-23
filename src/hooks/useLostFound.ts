import { useState, useCallback, useEffect, useMemo } from "react";

export type ItemStatus = "lost" | "found" | "claimed" | "expired";
export type ItemCategory = "electronics" | "clothing" | "keys" | "bags" | "documents" | "books" | "jewelry" | "other";

export interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  status: ItemStatus;
  location: string;
  dateReported: string;
  dateLostOrFound: string;
  contactName: string;
  contactInfo: string;
  reward: string;
  imageUrl: string;
  upvotes: number;
}

export interface LostFoundStats {
  totalItems: number;
  lostItems: number;
  foundItems: number;
  claimedItems: number;
  recentItems: number;
  categoryBreakdown: { category: string; count: number }[];
}

const CATEGORIES: Record<ItemCategory, { label: string; icon: string }> = {
  electronics: { label: "Electronics", icon: "📱" },
  clothing: { label: "Clothing", icon: "👕" },
  keys: { label: "Keys", icon: "🔑" },
  bags: { label: "Bags", icon: "🎒" },
  documents: { label: "Documents", icon: "📄" },
  books: { label: "Books", icon: "📚" },
  jewelry: { label: "Jewelry", icon: "💍" },
  other: { label: "Other", icon: "📌" },
};

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string }> = {
  lost: { label: "Lost", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  found: { label: "Found", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  claimed: { label: "Claimed", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  expired: { label: "Expired", color: "text-slate-500", bg: "bg-slate-500/10 border-slate-500/20" },
};

const STORAGE_KEY = "cc-lost-found";

function loadItems(): LostFoundItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveItems(items: LostFoundItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export interface UseLostFoundReturn {
  items: LostFoundItem[];
  filteredItems: LostFoundItem[];
  stats: LostFoundStats;
  addItem: (data: Omit<LostFoundItem, "id" | "upvotes">) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<Omit<LostFoundItem, "id">>) => void;
  upvoteItem: (id: string) => void;
  claimItem: (id: string) => void;
  clearAllData: () => void;
  statusFilter: ItemStatus | "all";
  setStatusFilter: (s: ItemStatus | "all") => void;
  categoryFilter: ItemCategory | "all";
  setCategoryFilter: (c: ItemCategory | "all") => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  categories: typeof CATEGORIES;
  statusConfig: typeof STATUS_CONFIG;
}

export function useLostFound(): UseLostFoundReturn {
  const [items, setItems] = useState<LostFoundItem[]>(loadItems);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { saveItems(items); }, [items]);

  // Auto-expire items older than 30 days
  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== "claimed" && daysAgo(item.dateReported) > 30) {
          return { ...item, status: "expired" as ItemStatus };
        }
        return item;
      }),
    );
  }, []);

  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.description.toLowerCase().includes(term) ||
          i.location.toLowerCase().includes(term),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((i) => i.category === categoryFilter);
    }

    // Sort: most recent first, then by upvotes
    result.sort((a, b) => {
      const dateDiff = new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.upvotes - a.upvotes;
    });

    return result;
  }, [items, statusFilter, categoryFilter, searchTerm]);

  const stats = useMemo((): LostFoundStats => {
    const active = items.filter((i) => i.status !== "expired");
    const recent = items.filter((i) => daysAgo(i.dateReported) <= 7);

    const catMap: Record<string, number> = {};
    items.forEach((i) => { catMap[i.category] = (catMap[i.category] ?? 0) + 1; });
    const categoryBreakdown = Object.entries(catMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalItems: items.length,
      lostItems: items.filter((i) => i.status === "lost").length,
      foundItems: items.filter((i) => i.status === "found").length,
      claimedItems: items.filter((i) => i.status === "claimed").length,
      recentItems: recent.length,
      categoryBreakdown,
    };
  }, [items]);

  const addItem = useCallback((data: Omit<LostFoundItem, "id" | "upvotes">) => {
    const newItem: LostFoundItem = {
      ...data,
      id: `lf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      upvotes: 0,
    };
    setItems((prev) => [newItem, ...prev]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Omit<LostFoundItem, "id">>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const upvoteItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i)),
    );
  }, []);

  const claimItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "claimed" as ItemStatus } : i)),
    );
  }, []);

  const clearAllData = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    items, filteredItems, stats, addItem, removeItem, updateItem,
    upvoteItem, claimItem, clearAllData,
    statusFilter, setStatusFilter, categoryFilter, setCategoryFilter,
    searchTerm, setSearchTerm, categories: CATEGORIES, statusConfig: STATUS_CONFIG,
  };
}

export { CATEGORIES, STATUS_CONFIG };
