import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { toast } from "sonner";

interface ImpeachmentVoteModalProps {
  clubId: string;
  targetUserId: string;
  targetUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImpeachmentVoteModal: React.FC<ImpeachmentVoteModalProps> = ({
  clubId,
  targetUserId,
  targetUserName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleCastVote = async () => {
    if (!reason.trim()) {
      toast.error("You must provide a reason for the impeachment vote.");
      return;
    }

    if (!browserSupportsWebAuthn()) {
      toast.error("WebAuthn is not supported on this device/browser. Cannot cast biometric vote.");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Request Challenge
      const { data: options, error: challengeErr } = await supabase.functions.invoke(
        "governance-action",
        {
          body: {
            action: "generate-challenge",
            actionType: "impeachment",
            payload: { clubId, targetUserId, reason },
          },
        },
      );

      if (challengeErr) throw challengeErr;
      if (options?.error) throw new Error(options.error);

      // 2. Authenticate locally with biometric passkey
      const authenticationResponse = await startAuthentication(options);

      // 3. Send signature to backend for cryptographically secure execution
      const { data: execData, error: execErr } = await supabase.functions.invoke(
        "governance-action",
        {
          body: {
            action: "execute",
            authenticationResponse,
          },
        },
      );

      if (execErr) throw execErr;
      if (execData?.error) throw new Error(execData.error);

      toast.success(execData.message || "Impeachment vote cast successfully.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to cast impeachment vote:", err);
      toast.error(err.message || "Failed to authorize and cast vote.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
            Cast Impeachment Vote
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            You are about to cast a formal impeachment vote against{" "}
            <strong>{targetUserName}</strong>. This is a high-stakes governance action and requires{" "}
            <strong>Biometric Authentication</strong> to verify your identity.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Impeachment
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-red-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              rows={4}
              placeholder="State the constitutional violations or failures in duty..."
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCastVote}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Authenticate & Vote
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
