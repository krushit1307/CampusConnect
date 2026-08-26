import { type ButtonProps } from "@/components/ui/button";
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
export declare function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  confirmVariant,
  loading,
}: ConfirmModalProps): import("react").JSX.Element;
export {};
