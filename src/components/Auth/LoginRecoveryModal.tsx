import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSessionRecoveryStore } from "@/store/useSessionRecoveryStore";
import { processQueue } from "@/lib/sessionRecovery";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Lock from "lucide-react/dist/esm/icons/lock";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

export function LoginRecoveryModal() {
  const { isOpen, userEmail, error, isSubmitting, setError, setSubmitting, closeModal } =
    useSessionRecoveryStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (userEmail) {
        setEmail(userEmail);
      } else if (typeof window !== "undefined") {
        const savedUser = localStorage.getItem("campusconnect_user_email");
        if (savedUser) setEmail(savedUser);
      }
      setPassword("");
    }
  }, [isOpen, userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Authenticate with Supabase or API
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email || "user@example.com",
        password,
      });

      if (authError) {
        throw new Error(authError.message || "Invalid credentials");
      }

      const newToken = data.session?.access_token || "recovered_token_" + Date.now();

      // Store email for future recovery
      if (email && typeof window !== "undefined") {
        localStorage.setItem("campusconnect_user_email", email);
      }

      // 2. Resolve all paused 401 requests with fresh JWT
      processQueue(null, newToken);

      toast.success("Session recovered! Resuming your work...");
      closeModal();
    } catch (err: any) {
      const msg = err.message || "Failed to re-authenticate. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    processQueue(new Error("Session recovery cancelled by user"));
    closeModal();
    toast.error("Session recovery cancelled. Unsaved changes may be lost.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="neu-border bg-white sm:max-w-md p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-amber-600">
            <Lock className="h-6 w-6" />
            <DialogTitle className="font-mono text-xl font-black uppercase text-black">
              Session Expired
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600">
            Your session timed out while you were working. Enter your password to securely log back
            in and automatically save your progress without losing any changes.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="neu-border bg-red-50 p-3 text-red-800 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block font-mono text-xs font-bold uppercase text-black mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full border-2 border-black p-2 font-mono text-sm outline-none focus:bg-lime/20"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-black mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              className="w-full border-2 border-black p-2 font-mono text-sm outline-none focus:bg-lime/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="neu-border bg-gray-100 font-mono text-xs uppercase"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="neu-border bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-authenticating...
                </>
              ) : (
                "Save & Resume Work"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
