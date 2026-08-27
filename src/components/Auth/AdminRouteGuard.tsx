import React, { useState } from "react";
import { useWebAuthn } from "@/hooks/useWebAuthn";

const HIGH_RISK_ROLES = ["President", "Treasurer"];

interface AdminRouteGuardProps {
  user: {
    id: string;
    email: string;
    role: string;
  };
  children: React.ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ user, children }) => {
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const { isSupported, isLoading, error, authenticateWithPasskey } = useWebAuthn();

  const isHighRisk = HIGH_RISK_ROLES.includes(user.role);

  // Role Demotion Edge Case: If user loses high-risk role, WebAuthn requirement is automatically bypassed
  if (!isHighRisk) {
    return <>{children}</>;
  }

  const handleStepUpAuth = async () => {
    const result = await authenticateWithPasskey(user.email);
    if (result.success) {
      setIsVerified(true);
    }
  };

  if (isVerified) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-md border text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Security Step-Up Required</h2>
        <p className="text-sm text-gray-600 mb-6">
          As a <strong>{user.role}</strong>, you must authenticate with your hardware key (YubiKey / Passkey / Biometric) to access sensitive club financials.
        </p>

        {!isSupported && (
          <div className="mb-4 text-xs text-amber-700 bg-amber-50 p-2 rounded">
            WebAuthn is not supported in this browser. Please use a supported browser or contact the Student Union for recovery.
          </div>
        )}

        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleStepUpAuth}
          disabled={isLoading || !isSupported}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50"
        >
          {isLoading ? "Verifying Hardware Key..." : "Authenticate with Hardware Key"}
        </button>

        <div className="mt-4 text-xs text-gray-500">
          Lost your key? Contact the Student Union to verify your physical student ID for account recovery.
        </div>
      </div>
    </div>
  );
};
