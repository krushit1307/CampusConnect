import { useState, useCallback, useEffect, useMemo } from "react";

export type ContactCategory = "emergency" | "health" | "security" | "academic" | "housing" | "counseling" | "transport" | "it-support" | "other";

export interface EmergencyContact {
  id: string;
  name: string;
  category: ContactCategory;
  phone: string;
  email: string;
  location: string;
  hours: string;
  description: string;
  isFavorite: boolean;
  isPinned: boolean;
  isCustom: boolean;
}

export interface ContactStats {
  total: number;
  favorites: number;
  pinned: number;
  byCategory: { category: string; count: number }[];
}

const CATEGORIES: Record<ContactCategory, { label: string; icon: string; color: string; bg: string }> = {
  emergency: { label: "Emergency", icon: "\u{1F6A8}", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  health: { label: "Health Services", icon: "\u{1F3E5}", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  security: { label: "Campus Security", icon: "\u{1F6E1}\uFE0F", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  academic: { label: "Academic", icon: "\u{1F4DA}", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  housing: { label: "Housing", icon: "\u{1F3E0}", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  counseling: { label: "Counseling", icon: "\u{1F4A4}", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  transport: { label: "Transport", icon: "\u{1F68C}", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  "it-support": { label: "IT Support", icon: "\u{1F4BB}", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  other: { label: "Other", icon: "\u{1F4CC}", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
};

const STORAGE_KEY = "cc-emergency-contacts";

const DEFAULT_CONTACTS: Omit<EmergencyContact, "id">[] = [
  { name: "911 Emergency", category: "emergency", phone: "911", email: "", location: "", hours: "24/7", description: "Police, Fire, Medical emergencies", isFavorite: false, isPinned: true, isCustom: false },
  { name: "Campus Police", category: "security", phone: "(555) 100-2000", email: "security@campus.edu", location: "Public Safety Building", hours: "24/7", description: "Campus security, escorts, incident reports", isFavorite: false, isPinned: true, isCustom: false },
  { name: "Student Health Center", category: "health", phone: "(555) 100-3000", email: "health@campus.edu", location: "Health Services Bldg", hours: "Mon-Fri 8am-5pm", description: "Medical appointments, immunizations, prescriptions", isFavorite: false, isPinned: false, isCustom: false },
  { name: "Crisis Hotline", category: "counseling", phone: "(555) 100-4000", email: "counseling@campus.edu", location: "Student Wellness Center", hours: "24/7", description: "Mental health crisis support, suicide prevention", isFavorite: false, isPinned: true, isCustom: false },
  { name: "Registrar Office", category: "academic", phone: "(555) 100-5000", email: "registrar@campus.edu", location: "Admin Building", hours: "Mon-Fri 9am-4pm", description: "Enrollment, transcripts, degree verification", isFavorite: false, isPinned: false, isCustom: false },
  { name: "Housing & Residence Life", category: "housing", phone: "(555) 100-6000", email: "housing@campus.edu", location: "Residence Hall Office", hours: "Mon-Fri 8am-6pm", description: "Room assignments, maintenance requests, RAs", isFavorite: false, isPinned: false, isCustom: false },
  { name: "Campus Shuttle", category: "transport", phone: "(555) 100-7000", email: "", location: "Main Transit Hub", hours: "Mon-Sat 7am-11pm", description: "Campus bus routes, schedules, accessibility transport", isFavorite: false, isPinned: false, isCustom: false },
  { name: "IT Help Desk", category: "it-support", phone: "(555) 100-8000", email: "ithelp@campus.edu", location: "Tech Center", hours: "Mon-Fri 8am-8pm", description: "WiFi, email, software, hardware issues", isFavorite: false, isPinned: false, isCustom: false },
];

function loadContacts(): EmergencyContact[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    // First load: seed with defaults
    return DEFAULT_CONTACTS.map((c, i) => ({ ...c, id: `default-${i}` }));
  } catch {
    return DEFAULT_CONTACTS.map((c, i) => ({ ...c, id: `default-${i}` }));
  }
}

function saveContacts(contacts: EmergencyContact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export interface UseEmergencyContactsReturn {
  contacts: EmergencyContact[];
  filteredContacts: EmergencyContact[];
  stats: ContactStats;
  addContact: (data: Omit<EmergencyContact, "id">) => void;
  removeContact: (id: string) => void;
  updateContact: (id: string, patch: Partial<Omit<EmergencyContact, "id">>) => void;
  toggleFavorite: (id: string) => void;
  togglePinned: (id: string) => void;
  clearAllData: () => void;
  categoryFilter: ContactCategory | "all";
  setCategoryFilter: (c: ContactCategory | "all") => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (v: boolean) => void;
  categories: typeof CATEGORIES;
}

export function useEmergencyContacts(): UseEmergencyContactsReturn {
  const [contacts, setContacts] = useState<EmergencyContact[]>(loadContacts);
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => { saveContacts(contacts); }, [contacts]);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    if (showFavoritesOnly) {
      result = result.filter((c) => c.isFavorite);
    }

    if (categoryFilter !== "all") {
      result = result.filter((c) => c.category === categoryFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          c.location.toLowerCase().includes(term),
      );
    }

    // Pinned first, then favorites, then alphabetical
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [contacts, categoryFilter, searchTerm, showFavoritesOnly]);

  const stats = useMemo((): ContactStats => {
    const catMap: Record<string, number> = {};
    contacts.forEach((c) => { catMap[c.category] = (catMap[c.category] ?? 0) + 1; });
    return {
      total: contacts.length,
      favorites: contacts.filter((c) => c.isFavorite).length,
      pinned: contacts.filter((c) => c.isPinned).length,
      byCategory: Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
  }, [contacts]);

  const addContact = useCallback((data: Omit<EmergencyContact, "id">) => {
    const newContact: EmergencyContact = {
      ...data,
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setContacts((prev) => [newContact, ...prev]);
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateContact = useCallback((id: string, patch: Partial<Omit<EmergencyContact, "id">>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c)));
  }, []);

  const togglePinned = useCallback((id: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)));
  }, []);

  const clearAllData = useCallback(() => {
    setContacts([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    contacts, filteredContacts, stats, addContact, removeContact, updateContact,
    toggleFavorite, togglePinned, clearAllData,
    categoryFilter, setCategoryFilter, searchTerm, setSearchTerm,
    showFavoritesOnly, setShowFavoritesOnly, categories: CATEGORIES,
  };
}

export { CATEGORIES };
