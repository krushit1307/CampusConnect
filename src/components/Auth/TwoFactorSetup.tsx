// =============================================================================
// Component: TwoFactorSetup
// Issue: #2386 - Implement Time-Based One-Time Password (TOTP) 2FA system
// Description: UI for scanning QR code and verifying initial TOTP setup.
// Supports Dark/Light mode via Tailwind CSS classes.
// =============================================================================

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"generate" | "verify">("generate");

  useEffect(() => {
    if (step === "generate") {
      generateQrCode();
    }
  }, [step]);

  const generateQrCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("2fa-setup", {
        body: { action: "generate" },
      });
      if (error) throw error;
      setQrCodeUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("2fa-setup", {
        body: { action: "verify_setup", code },
      });
      if (error) throw error;
      onComplete();
    } catch (err: any) {
      setError(err.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Enable Two-Factor Authentication
        </h2>

        {step === "generate" && loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Scan the QR code below with your authenticator app (Google Authenticator, Authy,
              etc.).
            </p>

            {qrCodeUrl && (
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Manual entry code:</p>
              <p className="font-mono text-sm font-bold text-gray-900 dark:text-white break-all">
                {secret}
              </p>
            </div>

            <div>
              <label
                htmlFor="totp-code"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                Enter 6-digit verification code
              </label>
              <input
                id="totp-code"
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-xl tracking-widest font-mono"
                placeholder="000000"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? "Verifying..." : "Enable 2FA"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
