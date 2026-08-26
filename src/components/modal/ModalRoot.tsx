import { FocusTrap } from "@/components/accessibility/FocusTrap";
import { useModal } from "./ModalContext";
import type { ModalKind } from "./ModalContext.types";
import type { ComponentType, ReactNode } from "react";

export interface ModalRegistration<K extends ModalKind> {
  render: (props: unknown) => ReactNode;
}

export type ModalRegistrationMap = {
  [K in ModalKind]?: ModalRegistration<K>;
};

interface ModalRootProps {
  registrations: ModalRegistrationMap;
}

export function ModalRoot({ registrations }: ModalRootProps) {
  const { activeModal, modalProps, closeModal } = useModal();
  if (!activeModal) return null;

  const registration = registrations[activeModal];
  if (!registration) {
    if (typeof console !== "undefined") {
      console.warn(`[ModalRoot] No registration for kind "${activeModal}"`);
    }
    return null;
  }

  return (
    <FocusTrap data-testid="modal-focus-trap">
      <div
        data-testid="modal-root"
        data-active-modal={activeModal}
        role="presentation"
        onKeyDown={(event) => {
          if (event.key === "Escape") closeModal();
        }}
      >
        {registration.render(modalProps)}
      </div>
    </FocusTrap>
  );
}

export function makeRegistrations<K extends ModalKind>(
  map: Partial<{
    [P in K]: ComponentType<{ modalProps: unknown; onClose: () => void }>;
  }>,
): ModalRegistrationMap {
  const out: ModalRegistrationMap = {};
  for (const [kind, Component] of Object.entries(map)) {
    if (!Component) continue;
    out[kind as K] = {
      render: (props) => <Component modalProps={props} onClose={() => {}} />,
    };
  }
  return out;
}
