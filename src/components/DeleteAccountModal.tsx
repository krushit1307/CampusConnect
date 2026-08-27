"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { executeCryptographicAnonymization } from "@/services/accountAnonymizationService";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const [password, setPassword] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteConfirmationText !== "DELETE") {
      toast.error("Please type DELETE to confirm account deletion.");
      return;
    }

    setLoading(true);

    try {
      const userRes = await supabase.auth.getUser();
      const currentUser = userRes.data.user;

      if (!currentUser) {
        throw new Error("No authenticated session found.");
      }

      // 1. Verify password before executing deletion logic
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email || "",
        password,
      });

      if (authError) {
        throw new Error("Invalid password. Please verify your credentials.");
      }

      // 2. Trigger the Cryptographic Anonymization Background Pipeline
      const result = await executeCryptographicAnonymization(currentUser.id);

      if (!result.success) {
        throw new Error("Cryptographic anonymization pipeline failed.");
      }

      toast.success(
        "Account anonymized successfully! Personal PII, chat messages, and photos have been permanently erased."
      );

      // 3. Log out and redirect back to auth page
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to anonymize account.");
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Cryptographic Account Anonymization & Deletion">
      <form onSubmit={handleDelete} className="space-y-4">
        <p className="font-mono text-xs text-red-600 font-bold uppercase">
          ⚠️ Action is permanent and cannot be undone.
        </p>
        <div className="font-mono text-xs text-muted-foreground space-y-2 bg-red-50/50 p-3 border border-red-200 dark:border-red-900/50 rounded">
          <p>
            <strong>Cryptographic Anonymization Pipeline:</strong>
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Your account record will be converted into an untraceable shell user (<code className="bg-red-100 dark:bg-red-950 px-1 font-bold">Anonymous User</code> / <code className="bg-red-100 dark:bg-red-950 px-1 font-bold">deleted_user_...</code>).</li>
            <li>All your direct chat messages and uploaded photos will be permanently deleted.</li>
            <li>Your event RSVPs and financial ledger transactions will remain intact to preserve aggregate statistics, now pointing strictly to the untraceable shell user.</li>
          </ul>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirm-password"
            className="font-mono text-xs font-bold uppercase text-black block"
          >
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-red-50 dark:bg-zinc-900 dark:text-white"
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="confirm-text"
            className="font-mono text-xs font-bold uppercase text-black block"
          >
            Type "DELETE" to Confirm
          </label>
          <input
            id="confirm-text"
            type="text"
            required
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm uppercase outline-none focus:bg-red-50 dark:bg-zinc-900 dark:text-white"
            placeholder="DELETE"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            type="submit"
            disabled={loading || !deleteConfirmationText || !password}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Anonymizing & Deleting...
              </span>
            ) : (
              "Permanently Delete & Anonymize My Account"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

