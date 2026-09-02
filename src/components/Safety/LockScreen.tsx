import { useState } from "react";
import { ShieldAlert, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContinuousAuth } from "@/hooks/useContinuousAuth";

interface LockScreenProps {
  /** The current authenticated user's email (used to re-auth). */
  email: string | null;
  /** Unlock callback (password, duressPin). */
  onUnlock: (password: string, duressPin?: string | null) => Promise<boolean>;
  /** Whether this was triggered as a duress event (silent alert mode). */
  duressFlag?: boolean;
}

/**
 * Full-screen lock overlay shown when the escrow ledger is locked by the
 * continuous-authentication system. The UI is intentionally indistinguishable
 * from a normal security prompt — even when `duressFlag` is true — so an
 * attacker is never tipped off that a silent alert was sent to campus security.
 */
export function LockScreen({ email, onUnlock, duressFlag = false }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [duressPin, setDuressPin] = useState("");
  const [showDuress, setShowDuress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const ok = await onUnlock(password, duressPin || null);
      if (!ok) {
        setError("Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="neu-border w-full max-w-sm bg-cream p-8 shadow-[8px_8px_0_0_var(--color-ink)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-black">
            <ShieldAlert className="h-5 w-5 text-peach" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">Session Locked</h2>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-600">
              Please re-authenticate
            </p>
          </div>
        </div>

        <p className="mb-6 border-l-2 border-black pl-3 font-mono text-xs leading-relaxed text-gray-700">
          Your session has been locked for security. Verify your identity to resume.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="eyebrow mb-1 block font-mono text-[11px] font-bold uppercase text-black">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className="rounded-none border-2 border-black bg-white"
              placeholder="Enter your password"
            />
          </div>

          {email && <p className="font-mono text-[10px] text-gray-500">Signed in as: {email}</p>}

          {showDuress && (
            <div>
              <label className="eyebrow mb-1 block font-mono text-[11px] font-bold uppercase text-black">
                Security PIN
              </label>
              <Input
                type="password"
                value={duressPin}
                onChange={(e) => setDuressPin(e.target.value)}
                className="rounded-none border-2 border-black bg-white"
                placeholder="Enter security PIN"
              />
            </div>
          )}

          {error && <p className="font-mono text-xs font-bold text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "Verifying..." : "Unlock"}
          </Button>

          <button
            type="button"
            onClick={() => setShowDuress((v) => !v)}
            className="flex w-full items-center justify-center gap-1 font-mono text-[11px] font-bold text-gray-500 underline underline-offset-2 hover:text-black"
          >
            <KeyRound className="h-3 w-3" />
            {showDuress ? "Hide PIN field" : "I have a security PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
