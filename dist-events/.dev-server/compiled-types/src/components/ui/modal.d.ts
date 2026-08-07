import * as React from "react";
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}
export declare const Modal: React.FC<ModalProps>;
