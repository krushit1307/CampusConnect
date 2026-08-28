import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";

export const CURRENT_PRIVACY_POLICY_VERSION = 2; // Bumped to 2 for the new university sponsor rules (Issue #4428)

interface PrivacyConsentMiddlewareProps {
  userId: string;
  children: React.ReactNode;
}

export const PrivacyConsentMiddleware: React.FC<PrivacyConsentMiddlewareProps> = ({
  userId,
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function checkConsent() {
      const { data, error } = await supabase
        .from("profiles")
        .select("privacy_consent_date, privacy_policy_version")
        .eq("id", userId)
        .single();

      if (!isMounted) return;

      if (error || !data) {
        setLoading(false);
        return;
      }

      const { privacy_consent_date, privacy_policy_version } = data;

      if (!privacy_consent_date) {
        setNeedsConsent(true);
      } else {
        const lastConsent = new Date(privacy_consent_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Check if consent is older than 365 days OR policy version is outdated
        if (lastConsent < oneYearAgo) {
          setNeedsConsent(true);
        } else if ((privacy_policy_version || 0) < CURRENT_PRIVACY_POLICY_VERSION) {
          setNeedsConsent(true);
        }
      }

      setLoading(false);
    }

    void checkConsent();

    return () => {
      isMounted = false;
    };
  }, [userId, supabase]);

  const handleAgree = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_privacy_policy", {
      p_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    });

    if (error) {
      console.error("Failed to accept privacy policy:", error);
      setSubmitting(false);
      return;
    }

    setNeedsConsent(false);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (needsConsent) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
        <div className="w-full max-w-2xl border-4 border-indigo-500 bg-slate-950 p-8 shadow-[0_0_50px_rgba(99,102,241,0.3)]">
          <div className="mb-6 flex items-center justify-center gap-4 text-indigo-400">
            <ShieldAlert className="h-12 w-12" />
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-white">
              Privacy Policy Update
            </h1>
          </div>

          <div className="prose prose-invert mb-8 max-h-60 overflow-y-auto border-y border-slate-800 py-4 font-mono text-sm leading-relaxed text-slate-300">
            <p className="font-bold text-white">Action Required: Data Privacy Consent Renewal</p>
            <p>
              Our Privacy Policy has updated to comply with modern data privacy laws (including GDPR
              and CCPA) and new University guidelines regarding external sponsor data sharing.
            </p>
            <p>
              To continue using CampusConnect, you must review and agree to the latest terms. Your
              consent will be cryptographically hashed along with your IP address and timestamp for
              legal auditing and non-repudiation.
            </p>
            <ul className="list-inside list-disc text-indigo-300">
              <li>Consent expires annually (every 365 days).</li>
              <li>You must re-affirm consent whenever the global policy version increases.</li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-mono text-xs text-slate-500">
              By clicking agree, you acknowledge the terms above.
            </p>
            <Button
              onClick={handleAgree}
              disabled={submitting}
              className="neu-border w-full bg-indigo-600 px-8 py-6 font-display text-lg font-bold uppercase hover:bg-indigo-700 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Recording Consent...
                </>
              ) : (
                "I Agree & Consent"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
