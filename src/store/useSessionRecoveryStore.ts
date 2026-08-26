import { create } from "zustand";

export interface SessionRecoveryState {
  isOpen: boolean;
  isRecoveryInProgress: boolean;
  userEmail: string | null;
  error: string | null;
  isSubmitting: boolean;

  openModal: (userEmail?: string | null) => void;
  closeModal: () => void;
  setError: (error: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;
}

export const useSessionRecoveryStore = create<SessionRecoveryState>((set) => ({
  isOpen: false,
  isRecoveryInProgress: false,
  userEmail: null,
  error: null,
  isSubmitting: false,

  openModal: (userEmail = null) => {
    set({
      isOpen: true,
      isRecoveryInProgress: true,
      userEmail,
      error: null,
      isSubmitting: false,
    });
  },

  closeModal: () => {
    set({
      isOpen: false,
      isRecoveryInProgress: false,
      error: null,
      isSubmitting: false,
    });
  },

  setError: (error) => set({ error, isSubmitting: false }),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  reset: () =>
    set({
      isOpen: false,
      isRecoveryInProgress: false,
      userEmail: null,
      error: null,
      isSubmitting: false,
    }),
}));
