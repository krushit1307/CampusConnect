/**
 * Enterprise Architectural Specification & React Component:
 * Module: Public Certificate Verification Portal UI (campusconnect.edu/verify?id=cert_8f92a1b)
 * File: components/PublicCertificateVerificationPortal.tsx
 * Standard: React 18 Functional Component, Non-Spoofable Employer Verification
 * Compliance: WCAG 2.1 AA Accessibility, Cryptographic Shield Badge (#4261)
 */

import React, { useState, useEffect } from 'react';
import { certificateVerificationService, VerificationResult } from '../src/services/certificateVerificationService';

export interface PublicCertificateVerificationPortalProps {
  initialCertId?: string;
}

export const PublicCertificateVerificationPortal: React.FC<PublicCertificateVerificationPortalProps> = ({
  initialCertId = 'cert_8f92a1b'
}) => {
  const [certIdInput, setCertIdInput] = useState<string>(initialCertId);
  const [verifierOrg, setVerifierOrg] = useState<string>('Google');
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (initialCertId) {
      handleVerify(initialCertId);
    }
  }, [initialCertId]);

  const handleVerify = (idToVerify?: string) => {
    const targetId = idToVerify || certIdInput;
    const res = certificateVerificationService.verifyCertificate(targetId, verifierOrg);
    setResult(res);
  };

  return (
    <div className="verify-portal-container bg-slate-950 min-h-screen text-slate-100 font-sans p-6 flex flex-col items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl max-w-xl w-full">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              🛡️
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">CampusConnect Credential Verifier</h1>
              <p className="text-xs text-slate-400 font-mono">Public Cryptographic Third-Party Verification Portal</p>
            </div>
          </div>
          <span className="bg-slate-800 text-slate-300 text-xs font-mono px-3 py-1 rounded-full border border-slate-700">
            SSL / SHA-256
          </span>
        </div>

        {/* Search & Verifier Controls */}
        <div className="bg-slate-800/50 border border-slate-800 p-4 rounded-xl mb-6 flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-400 font-mono uppercase block mb-1">Certificate UUID String</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={certIdInput}
                onChange={(e) => setCertIdInput(e.target.value)}
                placeholder="e.g. cert_8f92a1b"
                className="bg-slate-950 border border-slate-700 text-white font-mono text-sm rounded-lg px-3 py-2 flex-1 outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => handleVerify()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2 rounded-lg transition-all"
              >
                Verify Credential
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono uppercase block mb-1">Verifying Organization (Employer)</label>
            <input
              type="text"
              value={verifierOrg}
              onChange={(e) => setVerifierOrg(e.target.value)}
              placeholder="e.g. Google, Microsoft, Meta"
              className="bg-slate-950 border border-slate-700 text-white font-mono text-xs rounded-lg px-3 py-1.5 w-full outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Verification Result Display Card */}
        {result && (
          <div
            className={`border-2 rounded-xl p-6 shadow-xl transition-all ${
              result.isValid
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-100'
                : 'bg-rose-950/80 border-rose-500/80 text-rose-100'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                {result.isValid ? '✅ OFFICIAL ACADEMIC CREDENTIAL VERIFIED' : '❌ VERIFICATION FAILED'}
              </span>
              <span className="text-xs font-mono opacity-75">{result.certificateId}</span>
            </div>

            <p className="text-sm leading-relaxed mb-4 font-sans font-medium">{result.verificationMessage}</p>

            {result.isValid && (
              <div className="bg-slate-950/60 border border-emerald-500/30 p-3.5 rounded-lg font-mono text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Student:</span>
                  <span className="text-white font-bold">{result.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Event Series:</span>
                  <span className="text-emerald-300">{result.eventSeriesTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hosting Club:</span>
                  <span className="text-white">{result.hostingClubName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Issue Date:</span>
                  <span className="text-white">{result.completionDate}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 truncate">
                  SHA-256 Hash: {result.cryptographicHash}
                </div>
              </div>
            )}

            {result.studentNotificationAlert && (
              <div className="mt-4 bg-emerald-900/60 border border-emerald-400/30 p-2.5 rounded-lg text-xs font-mono text-emerald-200">
                {result.studentNotificationAlert}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
