"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

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
      // 1. Verify password before executing deletion logic
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || "",
        password,
      });

      if (authError) {
        throw new Error("Invalid password. Please verify your credentials.");
      }

      // 2. Call the Supabase Edge Function to cascade delete user data and the identity
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to execute account deletion.");
      }

      toast.success("Your account and data have been successfully deleted.");
      // 3. Log out and redirect back to auth page
      await supabase.auth.signOut();
      window.location.href = "/auth";
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete account.");
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Delete Account Permanently">
      <form onSubmit={handleDelete} className="space-y-4">
        <p className="font-mono text-xs text-red-600 font-bold uppercase">
          ⚠️ Action is permanent and cannot be undone.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Under GDPR/CCPA, this will completely clean up your user profile, files, and memberships.
          Please type your password and "DELETE" to confirm.
        </p>

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
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-red-50"
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
            className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm uppercase outline-none focus:bg-red-50"
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
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
              </span>
            ) : (
              "Permanently Delete My Account"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
