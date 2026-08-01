import { useModal } from "./ModalContext";
import type { ModalKind } from "./ModalContext.types";
import type { ComponentType, ReactNode } from "react";

/**
 * A registration entry in <ModalRoot />: maps a ModalKind to the
 * React component that should render for it, plus a small wrapper
 * that bridges the modalProps the context holds to the props the
 * component actually expects.
 */
export interface ModalRegistration<K extends ModalKind> {
  /**
   * Pure renderer that takes the active modal's props and returns
   * the React node to mount. Returning null means "don't render
   * anything for this kind right now" — useful for modals that
   * defer until something is ready.
   */
  render: (props: unknown) => ReactNode;
}

/**
 * Map of ModalKind -> registration. Concrete modals register
 * themselves by extending this map at the call site of
 * <ModalRoot registrations={...} />.
 */
export type ModalRegistrationMap = {
  [K in ModalKind]?: ModalRegistration<K>;
};

interface ModalRootProps {
  registrations: ModalRegistrationMap;
}

/**
 * ModalRoot — the global modal renderer (issue #1916 step 2/3).
 *
 * Sits at the top of App.tsx and listens to the modal context. When
 * `activeModal` is set, it looks up the registration and mounts the
 * matching component, passing it the modalProps from the context.
 *
 * Closing the modal (via the registered closeOn prop, a backdrop
 * click, or Escape) calls `closeModal()` from the context. Closing
 * unmounts the child entirely, wiping its internal state cleanly —
 * which is what the issue asks for at the end of step 5.
 */
export function ModalRoot({ registrations }: ModalRootProps) {
  const { activeModal, modalProps, closeModal } = useModal();

  if (!activeModal) return null;

  const registration = registrations[activeModal];
  if (!registration) {
    // A kind is active but no one registered a renderer for it.
    // That's a developer error; surface a clear console message so
    // it's easy to debug without crashing the app.
    if (typeof console !== "undefined") {
      console.warn(`[ModalRoot] No registration for kind "${activeModal}"`);
    }
    return null;
  }

  const node = registration.render(modalProps);

  return (
    <div
      data-testid="modal-root"
      data-active-modal={activeModal}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeModal();
      }}
    >
      {node}
    </div>
  );
}

/**
 * Helper that adapts a typed component to a registration. Lets
 * callers write:
 *
 *   <ModalRoot registrations={makeRegistrations({
 *     BUG_REPORT: BugReportModalBody,
 *     LOGIN: LoginModalBody,
 *   })} />
 */
export function makeRegistrations<K extends ModalKind>(
  map: Partial<{
    [P in K]: ComponentType<{ modalProps: unknown; onClose: () => void }>;
  }>,
): ModalRegistrationMap {
  const out: ModalRegistrationMap = {};
  for (const [k, Comp] of Object.entries(map)) {
    if (!Comp) continue;
    out[k as K] = {
      render: (props) => <Comp modalProps={props} onClose={() => {}} />,
    };
  }
  return out;
}
