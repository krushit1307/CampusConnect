import { useState, useCallback, useRef, useEffect } from "react";

export function useUndoableState<T>(initialPresent: T, debounceMs = 1000) {
  const [state, setState] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const debouncedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPresentRef = useRef<T>(initialPresent);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback(
    (newPresent: T | ((prev: T) => T), isUndoRedoAction = false) => {
      if (isUndoRedoAction) {
        setState((curr) => {
          const resolvedPresent =
            typeof newPresent === "function"
              ? (newPresent as (prev: T) => T)(curr.present)
              : newPresent;
          return {
            past: curr.past,
            present: resolvedPresent,
            future: curr.future,
          };
        });
        return;
      }

      const resolvedNewPresent =
        typeof newPresent === "function"
          ? (newPresent as (prev: T) => T)(pendingPresentRef.current)
          : newPresent;
      pendingPresentRef.current = resolvedNewPresent;

      if (debouncedTimerRef.current) {
        clearTimeout(debouncedTimerRef.current);
      }

      debouncedTimerRef.current = setTimeout(() => {
        setState((curr) => {
          if (JSON.stringify(curr.present) === JSON.stringify(resolvedNewPresent)) {
            return curr;
          }
          return {
            past: [...curr.past, curr.present],
            present: resolvedNewPresent,
            future: [],
          };
        });
      }, debounceMs);

      setState((curr) => ({
        ...curr,
        present: resolvedNewPresent,
      }));
    },
    [debounceMs],
  );

  const undo = useCallback(() => {
    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }
    setState((curr) => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      pendingPresentRef.current = previous;
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }
    setState((curr) => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      pendingPresentRef.current = next;
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const resetState = useCallback((newPresent: T) => {
    if (debouncedTimerRef.current) {
      clearTimeout(debouncedTimerRef.current);
    }
    pendingPresentRef.current = newPresent;
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  useEffect(() => {
    return () => {
      if (debouncedTimerRef.current) {
        clearTimeout(debouncedTimerRef.current);
      }
    };
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    resetState,
  };
}
