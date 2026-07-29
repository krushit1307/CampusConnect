import React from "react";
interface ReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    targetType: "post" | "comment" | "club" | "event";
    targetId: string;
}
export declare const ReportDialog: React.FC<ReportDialogProps>;
export {};
