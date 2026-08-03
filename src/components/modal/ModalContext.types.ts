/**
 * Modal kind registry — the union of every modal the app knows how to
 * show through the unified <ModalRoot /> (issue #1916).
 *
 * Adding a new modal kind is a 3-step process:
 *   1. Add a new entry to {@link ModalKind} below.
 *   2. Add the corresponding entry to MODAL_PROPS_MAP describing the
 *      props the kind receives.
 *   3. Add the React node registration to ModalRoot's registry.
 *
 * Centralising this in a single file means TypeScript will catch
 * any caller that opens a modal without supplying its required props.
 */

/**
 * The kind identifier. Keep this a string-literal union so the
 * switch/case in ModalRoot exhaustiveness-checks correctly.
 */
export type ModalKind = "BUG_REPORT" | "COMMAND_PALETTE" | "LOGIN" | "FILTERS" | "SHARE";

/**
 * Props bag indexed by kind. Each entry is `unknown` by default —
 * consumers should narrow with a type guard before use. This is the
 * pragmatic alternative to a deeply-narrowed generic which would
 * complicate the context API.
 *
 * If you add a kind with required props, also update MODAL_PROPS_HINT
 * below so the openModal() helper can warn at the call site.
 */
export type ModalPropsByKind = {
  BUG_REPORT: undefined;
  COMMAND_PALETTE: { initialQuery?: string } | undefined;
  LOGIN: { redirectTo?: string } | undefined;
  FILTERS: { clubId?: string } | undefined;
  SHARE: { url: string; title?: string } | undefined;
};

/**
 * Snapshot of the modal manager's state.
 */
export interface ModalState {
  activeModal: ModalKind | null;
  modalProps: unknown;
}

/**
 * Public context value type — exposed to consumers via {@link useModal}.
 */
export interface ModalContextValue {
  /** Currently active modal, or null when nothing is shown. */
  activeModal: ModalKind | null;
  /** Opaque props bag; consumers narrow with a type guard. */
  modalProps: unknown;
  /**
   * Open a modal by kind. If another modal is already active it is
   * replaced — issue #1916 spec: only one complex overlay at a time.
   */
  openModal: <K extends ModalKind>(kind: K, props?: ModalPropsByKind[K]) => void;
  /** Close the currently active modal. */
  closeModal: () => void;
  /** True when the supplied kind is currently active. */
  isOpen: (kind: ModalKind) => boolean;
}
