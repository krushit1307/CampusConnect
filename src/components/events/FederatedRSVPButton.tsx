import React, { useState } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface FederatedRSVPButtonProps {
  originDomain: string;
  originEventId: string;
  hostInstitution: string;
  userEmail?: string;
  className?: string;
}

export const FederatedRSVPButton: React.FC<FederatedRSVPButtonProps> = ({
  originDomain,
  originEventId,
  hostInstitution,
  userEmail,
  className = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFederatedRSVP = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke(
        "federated-oauth-handshake",
        {
          body: {
            origin_domain: originDomain,
            origin_event_id: originEventId,
            mentee_or_attendee_email: userEmail,
          },
        }
      );

      if (funcError) {
        throw new Error(funcError.message);
      }

      if (data?.redirect_url) {
        // Securely redirect student to host university instance for cross-campus ticket claim
        window.location.href = data.redirect_url;
      } else {
        throw new Error("Unable to obtain cross-campus authentication redirect.");
      }
    } catch (err) {
      setError((err as Error).message || "Federation handshake failed.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleFederatedRSVP}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to {hostInstitution}...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            <span>RSVP via {hostInstitution}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </>
        )}
      </button>
      {error && (
        <span className="text-xs text-rose-500 font-medium">{error}</span>
      )}
    </div>
  );
};
