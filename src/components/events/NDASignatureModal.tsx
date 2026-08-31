import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

interface NDASignatureModalProps {
  eventId: string;
  onClose: () => void;
  onSigned: () => void;
}

export function NDASignatureModal({ eventId, onClose, onSigned }: NDASignatureModalProps) {
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const createEnvelope = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/create-nda-envelope`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({ eventId }),
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to start NDA signing");
        if (!cancelled) setSigningUrl(result.signingUrl);
      } catch (err: any) {
        toast.error(err.message || "Failed to load NDA");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    createEnvelope();

    // Poll for completion, since DocuSign's completion redirect happens
    // inside the iframe and the webhook writes the row asynchronously.
    const poll = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("event_nda_signatures")
        .select("status")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.status === "completed") {
        clearInterval(poll);
        onSigned();
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [eventId, onClose, onSigned]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative h-[80vh] w-full max-w-2xl bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black p-1 text-white"
          aria-label="Close NDA signing"
        >
          <X size={16} />
        </button>
        {loading || !signingUrl ? (
          <div className="flex h-full items-center justify-center font-mono text-sm">
            Preparing NDA...
          </div>
        ) : (
          <iframe
            src={signingUrl}
            title="NDA Signature"
            className="h-full w-full"
            allow="camera"
          />
        )}
      </div>
    </div>
  );
}