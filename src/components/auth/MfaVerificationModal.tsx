import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, AlertCircle, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface MfaVerificationModalProps {
  isOpen: boolean;
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MfaVerificationModal: React.FC<MfaVerificationModalProps> = ({
  isOpen,
  factorId,
  onSuccess,
  onCancel,
}) => {
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit authentication code.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Create MFA Challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify MFA Challenge
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast.success("MFA verification successful!");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid authentication code. Please try again.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-yellow-300">
              <Lock className="h-6 w-6 text-black" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-black font-display">
                Two-Factor Authentication Required
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-gray-600">
                Enter the 6-digit code from your authenticator app to complete sign-in.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleVerify} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 border-2 border-black bg-red-100 flex items-center gap-2 text-xs font-mono text-red-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-mono text-xs font-bold uppercase mb-2">
              Authenticator Security Code:
            </label>
            <Input
              type="text"
              maxLength={6}
              placeholder="000000"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="border-2 border-black font-mono text-center text-2xl font-bold tracking-widest py-3"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-2 border-black font-mono text-xs uppercase"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
              Verify Sign-in
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
