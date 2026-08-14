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
import KeyRound from "lucide-react/dist/esm/icons/key-round";
import Shield from "lucide-react/dist/esm/icons/shield";
import Fingerprint from "lucide-react/dist/esm/icons/fingerprint-pattern";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import { toast } from "sonner";

interface RegisteredPasskey {
  id: string;
  name: string;
  type: "FaceID / TouchID" | "Windows Hello" | "Hardware Key";
  created_at: string;
  last_used_at: string;
}

interface PasskeyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "register" | "authenticate";
  onSuccess?: () => void;
}

export const PasskeyAuthModal: React.FC<PasskeyAuthModalProps> = ({
  isOpen,
  onClose,
  mode = "authenticate",
  onSuccess,
}) => {
  const [passkeys, setPasskeys] = useState<RegisteredPasskey[]>([
    {
      id: "pk_1",
      name: "MacBook Air TouchID",
      type: "FaceID / TouchID",
      created_at: "2026-06-15",
      last_used_at: "2026-07-28",
    },
    {
      id: "pk_2",
      name: "YubiKey 5C NFC",
      type: "Hardware Key",
      created_at: "2026-07-01",
      last_used_at: "2026-07-29",
    },
  ]);

  const [newKeyName, setNewKeyName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeMode, setActiveMode] = useState<"register" | "authenticate">(mode);

  const handleRegisterPasskey = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a label for your Passkey device.");
      return;
    }

    setIsRegistering(true);
    setTimeout(() => {
      setIsRegistering(false);
      const newPk: RegisteredPasskey = {
        id: `pk_${Date.now()}`,
        name: newKeyName,
        type: "FaceID / TouchID",
        created_at: new Date().toISOString().split("T")[0],
        last_used_at: "Just now",
      };
      setPasskeys([...passkeys, newPk]);
      setNewKeyName("");
      toast.success(`Passkey "${newPk.name}" successfully registered!`);
      setActiveMode("authenticate");
    }, 1500);
  };

  const handleSimulatePasskeyLogin = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      toast.success("Passkey Biometric Verification Succeeded!");
      onSuccess?.();
      onClose();
    }, 1200);
  };

  const handleDeletePasskey = (id: string) => {
    setPasskeys(passkeys.filter((p) => p.id !== id));
    toast.success("Passkey removed.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-purple-300">
              <Fingerprint className="h-6 w-6 text-purple-950" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-black font-display">
                Passkeys & Biometrics
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-gray-600">
                Passwordless sign-in with Touch ID, Face ID, or Security Keys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Mode Switcher */}
          <div className="flex border-2 border-black p-1 bg-cream font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveMode("authenticate")}
              className={`flex-1 py-1 text-center transition-colors cursor-pointer ${
                activeMode === "authenticate" ? "bg-black text-cream" : "text-black hover:bg-white"
              }`}
            >
              Sign-In
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("register")}
              className={`flex-1 py-1 text-center transition-colors cursor-pointer ${
                activeMode === "register" ? "bg-black text-cream" : "text-black hover:bg-white"
              }`}
            >
              Manage / Add
            </button>
          </div>

          {activeMode === "authenticate" ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-24 w-24 items-center justify-center border-2 border-black bg-purple-100 shadow-[4px_4px_0_0_var(--color-ink)]">
                <Fingerprint
                  className={`h-14 w-14 text-purple-900 ${isAuthenticating ? "animate-pulse" : ""}`}
                />
              </div>

              <div>
                <h4 className="font-bold text-sm text-black">Touch ID or Face ID Ready</h4>
                <p className="font-mono text-xs text-gray-600 mt-1">
                  Use your biometric scanner or hardware security key to sign in instantly without
                  typing a password.
                </p>
              </div>

              <Button
                type="button"
                disabled={isAuthenticating}
                onClick={handleSimulatePasskeyLogin}
                className="w-full border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase font-bold py-3 shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Scanning Biometrics...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Authenticate with Passkey
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add New Key Form */}
              <div className="p-3 border-2 border-black bg-cream space-y-2">
                <label className="block font-mono text-xs font-bold uppercase text-black">
                  Add New Passkey Device:
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="e.g. Work Laptop TouchID"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="border border-black font-mono text-xs bg-white"
                  />
                  <Button
                    type="button"
                    disabled={isRegistering || !newKeyName}
                    onClick={handleRegisterPasskey}
                    className="border-2 border-black bg-black text-cream font-mono text-xs font-bold uppercase shrink-0"
                  >
                    {isRegistering ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Add
                  </Button>
                </div>
              </div>

              {/* Existing Passkeys List */}
              <div className="space-y-2">
                <p className="font-mono text-xs font-bold uppercase text-black">
                  Registered Passkeys ({passkeys.length}):
                </p>

                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between p-3 border-2 border-black bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-gray-700" />
                      <div>
                        <p className="font-bold text-xs text-black">{pk.name}</p>
                        <p className="font-mono text-[10px] text-gray-500">
                          {pk.type} • Last active {pk.last_used_at}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="p-1 border border-black hover:bg-red-100 text-red-700 cursor-pointer"
                      title="Remove passkey"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
