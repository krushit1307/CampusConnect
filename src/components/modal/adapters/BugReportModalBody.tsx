import { BugReportModal } from "@/components/Modals/BugReportModal";
import { useModal } from "@/components/modal";

/**
 * Adapter that wraps the existing <BugReportModal /> so it can be
 * driven by the unified modal manager (issue #1916).
 *
 * Existing <BugReportModal /> takes `open` + `onOpenChange` props
 * because it was designed for inline state. This adapter:
 *   - reads the active kind from useModal()
 *   - reads onClose from the modal context's closeModal()
 *   - forwards `open` as (activeModal === "BUG_REPORT")
 *
 * Keeps the existing BugReportModal untouched so consumers that
 * still use it inline keep working.
 */
export function BugReportModalBody({
  modalProps,
  onClose,
}: {
  modalProps: unknown;
  onClose: () => void;
}) {
  const { activeModal } = useModal();
  const open = activeModal === "BUG_REPORT";
  return (
    <BugReportModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    />
  );
}
