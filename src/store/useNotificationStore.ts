import { create } from "zustand";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
}

interface NotificationState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],

  addToast: (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, ...toast };

    set((state: NotificationState) => ({
      toasts: [...state.toasts, newToast],
    }));

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((state: NotificationState) => ({
          toasts: state.toasts.filter((t: Toast) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  removeToast: (id: string) =>
    set((state: NotificationState) => ({
      toasts: state.toasts.filter((t: Toast) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}));

export const toast = (options: Omit<Toast, "id">) => {
  return useNotificationStore.getState().addToast(options);
};
