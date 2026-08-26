import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  college: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  read_at: string | null;
  content?: string;
  decryptFailed?: boolean;
}

interface ChatState {
  currentUser: User | null;
  profiles: Profile[];
  filteredProfiles: Profile[];
  searchQuery: string;
  loadingProfiles: boolean;

  activeRecipient: Profile | null;
  messages: Message[];
  loadingMessages: boolean;
  recipientKeyError: string | null;

  inputMessage: string;

  initializingKeys: boolean;
  userKeys: { publicKey: CryptoKey; privateKey: CryptoKey } | null;
  sharedKeys: Record<string, CryptoKey>;

  setCurrentUser: (user: User | null) => void;
  setProfiles: (profiles: Profile[]) => void;
  setSearchQuery: (query: string) => void;
  filterProfiles: () => void;
  setActiveRecipient: (profile: Profile | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessagesRead: (ids: string[]) => void;
  setInputMessage: (text: string) => void;
  setLoadingProfiles: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setInitializingKeys: (loading: boolean) => void;
  setRecipientKeyError: (error: string | null) => void;
  setUserKeys: (keys: { publicKey: CryptoKey; privateKey: CryptoKey } | null) => void;
  setSharedKey: (recipientId: string, key: CryptoKey) => void;
  resetSharedKeys: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentUser: null,
  profiles: [],
  filteredProfiles: [],
  searchQuery: "",
  loadingProfiles: false,

  activeRecipient: null,
  messages: [],
  loadingMessages: false,
  recipientKeyError: null,

  inputMessage: "",

  initializingKeys: true,
  userKeys: null,
  sharedKeys: {},

  setCurrentUser: (user) => set({ currentUser: user }),

  setProfiles: (profiles) => set({ profiles, filteredProfiles: profiles }),

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().filterProfiles();
  },

  filterProfiles: () => {
    const { profiles, searchQuery } = get();
    const q = searchQuery.toLowerCase();
    set({
      filteredProfiles: profiles.filter(
        (p) =>
          (p.full_name?.toLowerCase() || "").includes(q) ||
          (p.college?.toLowerCase() || "").includes(q),
      ),
    });
  },

  setActiveRecipient: (profile) =>
    set({
      activeRecipient: profile,
      messages: [],
      recipientKeyError: null,
    }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: state.messages.some((m) => m.id === message.id)
        ? state.messages
        : [...state.messages, message],
    })),

  updateMessagesRead: (ids) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m,
      ),
    })),

  setInputMessage: (text) => set({ inputMessage: text }),

  setLoadingProfiles: (loading) => set({ loadingProfiles: loading }),
  setLoadingMessages: (loading) => set({ loadingMessages: loading }),
  setInitializingKeys: (loading) => set({ initializingKeys: loading }),
  setRecipientKeyError: (error) => set({ recipientKeyError: error }),

  setUserKeys: (keys) => set({ userKeys: keys }),

  setSharedKey: (recipientId, key) =>
    set((state) => ({
      sharedKeys: { ...state.sharedKeys, [recipientId]: key },
    })),

  resetSharedKeys: () => set({ sharedKeys: {} }),
}));
