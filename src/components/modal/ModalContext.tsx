import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  ModalContextValue,
  ModalKind,
  ModalPropsByKind,
  ModalState,
} from "./ModalContext.types";

const ModalContext = createContext<ModalContextValue | null>(null);

export interface ModalProviderProps {
  children: ReactNode;
}

/**
 * ModalProvider — owns the single piece of modal state for the whole
 * app (issue #1916).
 *
 * State shape mirrors the issue spec exactly:
 *   { activeModal: string | null, modalProps: any }
 *
 * `openModal(kind, props)` replaces any currently-active modal so
 * callers can't end up with two overlays stacked on top of each
 * other (the bug the issue calls out: "If a user clicks Login, then
 * clicks a background Filter button, both modals open simultaneously,
 * fighting for Z-index supremacy").
 */
export function ModalProvider({ children }: ModalProviderProps) {
  const [state, setState] = useState<ModalState>({
    activeModal: null,
    modalProps: undefined,
  });

  const openModal = useCallback(<K extends ModalKind>(kind: K, props?: ModalPropsByKind[K]) => {
    setState({ activeModal: kind, modalProps: props });
  }, []);

  const closeModal = useCallback(() => {
    setState({ activeModal: null, modalProps: undefined });
  }, []);

  const isOpen = useCallback((kind: ModalKind) => state.activeModal === kind, [state.activeModal]);

  const value = useMemo<ModalContextValue>(
    () => ({
      activeModal: state.activeModal,
      modalProps: state.modalProps,
      openModal,
      closeModal,
      isOpen,
    }),
    [state.activeModal, state.modalProps, openModal, closeModal, isOpen],
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

/**
 * useModal — the consumer hook for the unified modal context.
 *
 * Throws if used outside a <ModalProvider>, so consumers get a
 * clear error message instead of silent undefined behavior.
 */
export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a <ModalProvider>");
  }
  return ctx;
}
