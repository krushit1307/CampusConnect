/**
 * Public surface of the unified modal manager (issue #1916).
 *
 * Consumers import from this barrel so internal file moves don't
 * break call sites.
 */

export type {
  ModalKind,
  ModalPropsByKind,
  ModalState,
  ModalContextValue,
} from "./ModalContext.types";

export { ModalProvider, useModal } from "./ModalContext";
export {
  ModalRoot,
  makeRegistrations,
  type ModalRegistration,
  type ModalRegistrationMap,
} from "./ModalRoot";
