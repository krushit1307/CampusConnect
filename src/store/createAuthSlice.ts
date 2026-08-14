import { createSignal } from "../lib/signals";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const [userSignal, setUserSignal] = createSignal<UserProfile | null>(null);

export function resetAuthSlice(): void {
  setUserSignal(null);
}

// ─── Slice factory for composition ───────────────────────────────────

export interface AuthSlice {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  resetAuthSlice: () => void;
}

type SetState<T> = (state: Partial<T> | ((prev: T) => Partial<T>)) => void;

export function createAuthSlice(set: SetState<AuthSlice>): AuthSlice {
  return {
    user: null,
    setUser: (user: UserProfile | null) => {
      setUserSignal(user);
      set({ user });
    },
    resetAuthSlice: () => {
      setUserSignal(null);
      set({ user: null });
    },
  };
}
