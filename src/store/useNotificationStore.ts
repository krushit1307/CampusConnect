import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { ssrSafeStorage } from "./middleware";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
}

interface NotificationState {
  /** Unread notifications badge count for the bell icon. */
  unreadCount: number;
  /** Active toast queue (rendered by <Toaster />). */
  toasts: Toast[];

  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set) => ({
        unreadCount: 0,
        toasts: [],

        addToast: (toast) => {
          const id = Math.random().toString(36).substring(2, 9);
          const newToast: Toast = { id, ...toast };

          set(
            (state) => ({ toasts: [...state.toasts, newToast] }),
            false,
            "notifications/addToast",
          );

          const duration = toast.duration ?? 5000;
          if (duration > 0) {
            setTimeout(() => {
              set(
                (state) => ({
                  toasts: state.toasts.filter((t) => t.id !== id),
                }),
                false,
                "notifications/autoDismissToast",
              );
            }, duration);
          }

          return id;
        },

        removeToast: (id) =>
          set(
            (state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }),
            false,
            "notifications/removeToast",
          ),

        clearToasts: () =>
          set({ toasts: [] }, false, "notifications/clearToasts"),

        setUnreadCount: (count) =>
          set({ unreadCount: Math.max(0, count) }, false, "notifications/setUnreadCount"),

        incrementUnread: () =>
          set(
            (state) => ({ unreadCount: state.unreadCount + 1 }),
            false,
            "notifications/incrementUnread",
          ),

        decrementUnread: () =>
          set(
            (state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) }),
            false,
            "notifications/decrementUnread",
          ),

        resetUnread: () =>
          set({ unreadCount: 0 }, false, "notifications/resetUnread"),
      }),
      {
        name: "campusconnect-notifications",
        storage: createJSONStorage(() => ssrSafeStorage),
        // Persist only the unread badge count; toasts are ephemeral.
        partialize: (state) => ({ unreadCount: state.unreadCount }),
        skipHydration: true, // see StoreHydrationGate
      },
    ),
    {
      name: "useNotificationStore",
      enabled: import.meta.env.DEV,
    },
  ),
);

export const toast = (options: Omit<Toast, "id">) => {
  return useNotificationStore.getState().addToast(options);
};
