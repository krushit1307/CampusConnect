import { create } from "zustand";

interface QueuedAction {
  id: string;
  timeoutId: ReturnType<typeof setTimeout>;
  execute: () => Promise<void>;
  rollback: () => void;
}

interface ActionQueueState {
  actions: Map<string, QueuedAction>;
  enqueue: (action: QueuedAction) => void;
  remove: (id: string) => void;
}

export const useActionQueue = create<ActionQueueState>((set) => ({
  actions: new Map(),

  enqueue: (action) =>
    set((state) => {
      const actions = new Map(state.actions);
      actions.set(action.id, action);
      return { actions };
    }),

  remove: (id) =>
    set((state) => {
      const actions = new Map(state.actions);
      actions.delete(id);
      return { actions };
    }),
}));

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    const actions = useActionQueue.getState().actions;
    actions.forEach((action) => {
      clearTimeout(action.timeoutId);
      action.execute();
    });
  });
}
