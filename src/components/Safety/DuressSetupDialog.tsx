import { useState } from "react";
import { ShieldQuestion, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Settings dialog for configuring the duress PIN.
 *
 * A duress PIN is a secondary code that — when entered on the LockScreen —
 * appears to unlock the device normally but actually triggers a SILENT
 * alert to campus security. This gives users a covert way to signal they are
 * under duress without tipping off an attacker.
 */
export function DuressSetupDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (pin.length < 4) {
      toast.error("Duress PIN must be at least 4 characters.");
      return;
    }
    if (pin !== confirm) {
      toast.error("PINs do not match.");
      return;
    }

    setLoading(true);
    try {
      // Store as a salted SHA-256 hash (server-side would be preferred; this
      // is a dependency-free client-side approximation).
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(`duress:${pin}`));
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hash = `sha256$${hex}`;

      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ duress_pin_hash: hash })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      toast.success("Duress PIN configured. An attacker will never see this.");
      setPin("");
      setConfirm("");
      setOpen(false);
    } catch {
      toast.error("Could not save duress PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ duress_pin_hash: null })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Duress PIN cleared.");
      setPin("");
      setConfirm("");
      setOpen(false);
    } catch {
      toast.error("Could not clear duress PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldQuestion className="h-4 w-4" />
          Configure Duress PIN
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-black">
        <DialogHeader>
          <DialogTitle>Duress PIN</DialogTitle>
          <DialogDescription>
            Set a covert PIN. If you are forced to unlock your device, enter the duress PIN instead
            of your real one — it will open normally but silently alert campus security.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-1 block font-mono text-[11px] font-bold uppercase">
              Duress PIN
            </label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="rounded-none border-2 border-black"
              placeholder="At least 4 characters"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="eyebrow mb-1 block font-mono text-[11px] font-bold uppercase">
              Confirm Duress PIN
            </label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-none border-2 border-black"
              placeholder="Re-enter duress PIN"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={loading}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Clear PIN
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
