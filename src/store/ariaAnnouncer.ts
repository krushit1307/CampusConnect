import { create } from "zustand";

interface AriaAnnouncerState {
  message: string;
  _setAnnounceMessage: (message: string) => void;
}

export const useAriaAnnouncer = create<AriaAnnouncerState>((set) => ({
  message: "",
  _setAnnounceMessage: (message) => {
    set({ message: "" });
    requestAnimationFrame(() => {
      set({ message });
    });
  },
}));

let timeout: ReturnType<typeof setTimeout>;

export function announce(message: string) {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    useAriaAnnouncer.getState()._setAnnounceMessage(message);
  }, 150);
}
