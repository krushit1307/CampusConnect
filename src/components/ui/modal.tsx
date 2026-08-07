import React, { ReactNode, useEffect, useRef, useId } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!isInDialog) {
      onClose();
    }
  };

  return (
    <>
      <style>{`
        dialog[open] {
          animation: modal-fade-in 0.2s ease-out, modal-zoom-in 0.2s ease-out;
        }
        dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          animation: modal-fade-in 0.2s ease-out;
        }
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-zoom-in {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
      `}</style>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        aria-labelledby={title && typeof title === "string" ? titleId : undefined}
        className={`relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 focus:outline-none ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}
        <div className={title ? "mt-4" : ""}>{children}</div>
      </dialog>
    </>
  );
};
