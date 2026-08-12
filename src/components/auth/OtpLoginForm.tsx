import React, { useState, useEffect, useRef } from "react";
import {
  sendOtpEmail,
  verifyOtpCode,
  cleanOtpInput,
  validateOtpCode,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/otpAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight, RefreshCw, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface OtpLoginFormProps {
  onSuccess?: () => void;
  defaultEmail?: string;
}

export function OtpLoginForm({ onSuccess, defaultEmail = "" }: OtpLoginFormProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    const res = await sendOtpEmail(email);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to send OTP code.");
      toast.error(res.error || "Failed to send verification code.");
      return;
    }

    toast.success("6-digit verification code sent to your email!");
    setStep("otp");
    setCooldown(RESEND_COOLDOWN_SECONDS);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleVerifyOtp = async (codeToVerify = otpCode) => {
    setErrorMessage("");
    const cleaned = cleanOtpInput(codeToVerify);

    if (!validateOtpCode(cleaned)) {
      setErrorMessage("Please enter the full 6-digit code.");
      return;
    }

    setIsLoading(true);
    const res = await verifyOtpCode(email, cleaned);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Invalid or expired code.");
      toast.error(res.error || "Verification failed.");
      return;
    }

    toast.success("Authentication successful!");
    onSuccess?.();
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cleanOtpInput(e.target.value);
    setOtpCode(val);
    setErrorMessage("");

    // Auto-submit when 6 digits entered
    if (val.length === 6) {
      handleVerifyOtp(val);
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const cleaned = cleanOtpInput(pasted);
    if (cleaned.length === 6) {
      setOtpCode(cleaned);
      handleVerifyOtp(cleaned);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isLoading) return;
    setIsLoading(true);
    const res = await sendOtpEmail(email);
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || "Failed to resend code.");
      return;
    }

    toast.success("New verification code sent!");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border rounded-xl shadow-sm space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Passwordless Sign In</h2>
        <p className="text-xs text-muted-foreground">
          {step === "email"
            ? "Enter your email to receive a 6-digit verification code"
            : `We sent a 6-digit code to ${email}`}
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/20 text-destructive font-medium"
        >
          {errorMessage}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={handleSendEmail} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="otp-email" className="text-xs font-medium">
              College Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="otp-email"
                type="email"
                placeholder="student@university.edu"
                className="pl-9 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2 font-medium" disabled={isLoading}>
            {isLoading ? "Sending Code..." : "Send Verification Code"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2 text-center">
            <Label
              htmlFor="otp-code"
              className="text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" /> Enter 6-Digit Code
            </Label>

            <Input
              ref={inputRef}
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={handleOtpChange}
              onPaste={handleOtpPaste}
              className="text-center font-mono text-2xl tracking-[0.5em] h-12 border-2 focus-visible:ring-primary"
              disabled={isLoading}
              aria-describedby="otp-help"
            />
            <p id="otp-help" className="text-[11px] text-muted-foreground">
              Paste or type the code sent to your inbox.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => handleVerifyOtp()}
            className="w-full gap-2 font-medium"
            disabled={isLoading || otpCode.length < 6}
          >
            {isLoading ? "Verifying..." : "Verify & Sign In"}
            <CheckCircle2 className="w-4 h-4" />
          </Button>

          <div className="flex items-center justify-between text-xs pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtpCode("");
                setErrorMessage("");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Change Email
            </button>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={cooldown > 0 || isLoading}
              className="flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
