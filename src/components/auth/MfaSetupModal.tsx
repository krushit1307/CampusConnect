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
import {
  ShieldCheck,
  Copy,
  Check,
  QrCode,
  Key,
  Smartphone,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface MfaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MfaSetupModal: React.FC<MfaSetupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<"choice" | "qr" | "verify" | "recovery" | "complete">("choice");
  const [method, setMethod] = useState<"totp" | "sms">("totp");
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mockSecretKey = "JBSWY3DPEHPK3PXP";
  const mockQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/CampusConnect:user@campus.edu?secret=${mockSecretKey}&issuer=CampusConnect`;
  const mockRecoveryCodes = [
    "A1B2-C3D4-E5F6",
    "G7H8-I9J0-K1L2",
    "M3N4-O5P6-Q7R8",
    "S9T0-U1V2-W3X4",
    "Y5Z6-7890-ABCD",
    "EFGH-IJKL-MNOP",
  ];

  const handleCopySecret = () => {
    navigator.clipboard.writeText(mockSecretKey);
    setCopiedKey(true);
    toast.success("Secret key copied to clipboard");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyRecovery = () => {
    navigator.clipboard.writeText(mockRecoveryCodes.join("\n"));
    setCopiedCodes(true);
    toast.success("Recovery codes copied to clipboard");
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleVerify = () => {
    setErrorMsg("");
    if (verificationCode.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit authentication code.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("recovery");
      toast.success("Two-Factor Authentication verified successfully!");
    }, 1000);
  };

  const handleFinish = () => {
    onSuccess?.();
    onClose();
    resetModal();
  };

  const resetModal = () => {
    setStep("choice");
    setVerificationCode("");
    setErrorMsg("");
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-yellow-300">
              <ShieldCheck className="h-6 w-6 text-black" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-black font-display">
                Two-Factor Authentication Setup
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-gray-600">
                Secure your CampusConnect account with an extra layer of protection.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {step === "choice" && (
            <div className="space-y-4">
              <p className="font-mono text-xs font-semibold text-black uppercase tracking-wider">
                Select Authentication Method:
              </p>

              <button
                type="button"
                onClick={() => {
                  setMethod("totp");
                  setStep("qr");
                }}
                className="w-full flex items-start gap-4 p-4 border-2 border-black bg-cream hover:bg-yellow-100 text-left transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                <div className="p-2 border border-black bg-white">
                  <QrCode className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-black">Authenticator App (Recommended)</h4>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    Use Google Authenticator, 1Password, or Authy to generate dynamic 6-digit codes.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod("sms");
                  setStep("qr");
                }}
                className="w-full flex items-start gap-4 p-4 border-2 border-black bg-cream hover:bg-sky/20 text-left transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                <div className="p-2 border border-black bg-white">
                  <Smartphone className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-black">SMS Mobile Verification</h4>
                  <p className="font-mono text-xs text-gray-600 mt-1">
                    Receive 6-digit verification security passcodes directly on your phone via SMS.
                  </p>
                </div>
              </button>
            </div>
          )}

          {step === "qr" && method === "totp" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 border-2 border-black bg-cream">
                <img
                  src={mockQrCodeUrl}
                  alt="MFA QR Code"
                  className="w-44 h-44 border-2 border-black bg-white p-2"
                />
                <p className="font-mono text-xs text-gray-700 mt-3 text-center">
                  Scan this QR code with your mobile authenticator app.
                </p>
              </div>

              <div className="p-3 border-2 border-black bg-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-bold text-gray-600 uppercase">
                    Secret Key (Manual Entry):
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopySecret}
                    className="h-7 px-2 font-mono text-xs border border-black"
                  >
                    {copiedKey ? (
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {copiedKey ? "Copied" : "Copy Key"}
                  </Button>
                </div>
                <code className="block w-full font-mono text-sm font-bold bg-gray-100 p-2 border border-black text-center tracking-widest text-black">
                  {mockSecretKey}
                </code>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("choice")}
                  className="flex-1 border-2 border-black font-mono text-xs uppercase"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep("verify")}
                  className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase shadow-[3px_3px_0_0_var(--color-ink)]"
                >
                  Next Step
                </Button>
              </div>
            </div>
          )}

          {step === "qr" && method === "sms" && (
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-bold uppercase mb-2">
                  Enter Mobile Phone Number:
                </label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="border-2 border-black font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("choice")}
                  className="flex-1 border-2 border-black font-mono text-xs uppercase"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={!phoneNumber}
                  onClick={() => setStep("verify")}
                  className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase shadow-[3px_3px_0_0_var(--color-ink)]"
                >
                  Send Verification SMS
                </Button>
              </div>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <p className="font-mono text-xs text-gray-700">
                Enter the 6-digit code displayed in your authenticator app to verify setup.
              </p>

              {errorMsg && (
                <div className="p-3 border-2 border-black bg-red-100 flex items-center gap-2 text-xs font-mono text-red-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block font-mono text-xs font-bold uppercase mb-2">
                  6-Digit Verification Code:
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="border-2 border-black font-mono text-center text-xl font-bold tracking-widest"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("qr")}
                  className="flex-1 border-2 border-black font-mono text-xs uppercase"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={loading || verificationCode.length !== 6}
                  onClick={handleVerify}
                  className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase shadow-[3px_3px_0_0_var(--color-ink)]"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
                  Verify Code
                </Button>
              </div>
            </div>
          )}

          {step === "recovery" && (
            <div className="space-y-4">
              <div className="p-3 border-2 border-black bg-amber-100">
                <h4 className="font-bold text-xs uppercase text-amber-900 flex items-center gap-1">
                  <Key className="h-4 w-4" /> Save Recovery Codes
                </h4>
                <p className="font-mono text-xs text-amber-900 mt-1">
                  Store these emergency recovery codes in a safe place. If you lose access to your
                  authenticator, you can use these to regain entry.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 border-2 border-black bg-white font-mono text-xs">
                {mockRecoveryCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 border border-black bg-cream font-bold text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleCopyRecovery}
                className="w-full border-2 border-black font-mono text-xs uppercase"
              >
                {copiedCodes ? (
                  <Check className="h-3 w-3 mr-1 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copiedCodes ? "Codes Copied" : "Copy All Recovery Codes"}
              </Button>

              <Button
                type="button"
                onClick={handleFinish}
                className="w-full border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                Complete Setup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
