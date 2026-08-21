import { create } from "zustand";

// Tracks posts that were just soft-deleted and are still inside their
// 10-second "Undo" window. Kept in a global store (not component state)
// so the pending delete — and the Undo toast's callback — survives even
// if the user navigates away from the page that started the delete (#2270).
export interface PendingDelete {
  postId: string;
  deletionToken: string;
}

interface PendingDeleteState {
  pending: Record<string, PendingDelete>;
  beginPendingDelete: (postId: string, deletionToken: string) => void;
  clearPendingDelete: (postId: string) => void;
  isPending: (postId: string) => boolean;
}

export const usePendingDeleteStore = create<PendingDeleteState>((set, get) => ({
  pending: {},

  beginPendingDelete: (postId: string, deletionToken: string) => {
    set((state) => ({
      pending: { ...state.pending, [postId]: { postId, deletionToken } },
    }));
  },

  clearPendingDelete: (postId: string) => {
    set((state) => {
      const next = { ...state.pending };
      delete next[postId];
      return { pending: next };
    });
  },

  isPending: (postId: string) => Boolean(get().pending[postId]),
}));
