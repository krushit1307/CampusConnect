import React, { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BottomSheet as UIBottomSheet,
  BottomSheetProps as UIBottomSheetProps,
} from "@/components/ui/bottom-sheet";

export interface BottomSheetProps extends Omit<UIBottomSheetProps, "children"> {
  children: ReactNode;
}

export function BottomSheet({ children, onClose, ...props }: BottomSheetProps) {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate("/events");
    }
  };

  return (
    <UIBottomSheet onClose={handleClose} {...props}>
      {children}
    </UIBottomSheet>
  );
}

export * from "@/components/ui/bottom-sheet";
