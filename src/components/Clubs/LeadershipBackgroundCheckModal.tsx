import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LeadershipBackgroundCheckModalProps {
  clubId: string;
  memberId: string;
  desiredRoleId: string;
  onClose: () => void;
}

export function LeadershipBackgroundCheckModal({
  clubId,
  memberId,
  desiredRoleId,
  onClose,
}: LeadershipBackgroundCheckModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function requestCheck() {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "club-leadership-background-check",
        {
          body: {
            action: "request",
            club_id: clubId,
            member_id: memberId,
            desired_role_id: desiredRoleId,
          },
        },
      );
      if (cancelled) return;
      if (invokeError || data?.error) setError(invokeError?.message || data.error);
      else setHostedUrl(data?.hosted_apply_url || null);
      setIsLoading(false);
    }
    void requestCheck();
    return () => {
      cancelled = true;
    };
  }, [clubId, memberId, desiredRoleId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="background-check-title"
    >
      <div className="neu-border max-h-[90vh] w-full max-w-3xl overflow-auto bg-cream p-6 text-black">
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div>
            <p className="eyebrow flex items-center gap-2 font-bold">
              <ShieldAlert className="h-4 w-4" /> High-risk leadership vetting
            </p>
            <h2 id="background-check-title" className="font-display mt-1 text-2xl font-bold">
              Complete the background check
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-border bg-white p-2"
            aria-label="Close background check"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex items-start gap-3 border-2 border-black bg-[#fff4d6] p-4 font-mono text-xs leading-relaxed">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            SSN, date of birth, disclosures, and report details are entered directly into the
            background-check provider’s hosted experience. CampusConnect does not collect or store
            those values. The leadership role stays pending until the provider webhook reports a
            clear result.
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 py-10 font-mono text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Preparing the secure provider flow…
          </div>
        )}
        {error && (
          <div className="mt-5 border-2 border-red-700 bg-red-100 p-4 font-mono text-sm text-red-900">
            {error}
          </div>
        )}
        {!isLoading && !error && hostedUrl && (
          <div className="mt-5">
            <iframe
              title="Provider background check"
              src={hostedUrl}
              className="h-[560px] w-full border-2 border-black bg-white"
              sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
            />
            <a
              href={hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 font-mono text-xs font-bold underline"
            >
              <ExternalLink className="h-3 w-3" /> Open securely in a new tab
            </a>
          </div>
        )}
        {!isLoading && !error && !hostedUrl && (
          <p className="py-10 font-mono text-sm">
            The provider invitation was created. Check your email to complete the hosted disclosure
            and consent flow.
          </p>
        )}
      </div>
    </div>
  );
}
