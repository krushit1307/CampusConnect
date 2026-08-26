import { createSignal } from "../lib/signals";

export const [notificationsCountSignal, setNotificationsCountSignal] = createSignal<number>(0);
export const [unreadMessagesCountSignal, setUnreadMessagesCountSignal] = createSignal<number>(0);

export function resetCacheSlice(): void {
  setNotificationsCountSignal(0);
  setUnreadMessagesCountSignal(0);
}

// ─── Slice factory for composition ───────────────────────────────────

export interface CacheSlice {
  notificationsCount: number;
  unreadMessagesCount: number;
  setNotificationsCount: (count: number) => void;
  setUnreadMessagesCount: (count: number) => void;
  resetCacheSlice: () => void;
}

type SetState<T> = (state: Partial<T> | ((prev: T) => Partial<T>)) => void;

export function createCacheSlice(set: SetState<CacheSlice>): CacheSlice {
  return {
    notificationsCount: 0,
    unreadMessagesCount: 0,
    setNotificationsCount: (count: number) => {
      setNotificationsCountSignal(count);
      set({ notificationsCount: count });
    },
    setUnreadMessagesCount: (count: number) => {
      setUnreadMessagesCountSignal(count);
      set({ unreadMessagesCount: count });
    },
    resetCacheSlice: () => {
      setNotificationsCountSignal(0);
      setUnreadMessagesCountSignal(0);
      set({ notificationsCount: 0, unreadMessagesCount: 0 });
    },
  };
}
