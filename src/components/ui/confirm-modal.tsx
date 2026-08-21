"use client";

import { Modal } from "@/components/ui/modal";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;

  onConfirm: () => void;
  onCancel: () => void;

  confirmText?: string;
  cancelText?: string;

  confirmVariant?: ButtonProps["variant"];

  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "destructive",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} title={title}>
      <div className="flex flex-col space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? "Please wait..." : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
