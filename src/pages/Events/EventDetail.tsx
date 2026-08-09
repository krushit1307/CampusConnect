import React, { useEffect } from "react";
import { useConfetti } from "../../hooks/useConfetti";

interface RSVPModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const RSVPSuccessModal: React.FC<RSVPModalProps> = ({ isOpen, onClose, studentName }) => {
  const { triggerSchoolColorsBurst } = useConfetti();

  useEffect(() => {
    // Fire the confetti the moment the success modal mounts and opens
    if (isOpen) {
      triggerSchoolColorsBurst();
    }
  }, [isOpen, triggerSchoolColorsBurst]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>🎉 Registration Successful!</h2>
        <p>You're all set for the event. We've sent the ticket details to your email.</p>
        <button onClick={onClose} className="close-btn">
          Awesome
        </button>
      </div>
    </div>
  );
};
