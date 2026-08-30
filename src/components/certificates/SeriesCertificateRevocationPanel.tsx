import { useMemo, useState } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Ban from "lucide-react/dist/esm/icons/ban";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from "sonner";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeRevocationReason,
  REVOCATION_REASON_MAX_LENGTH,
} from "@/lib/certificateRevocation";

interface IssuerCertificate {
  id: string;
  series_id: string;
  series_name: string;
  user_name: string;
  completion_date: string;
  pdf_url: string;
  issued_at: string;
  is_revoked: boolean;
  revocation_reason: string | null;
  revoked_at: string | null;
}

export function SeriesCertificateRevocationPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [certificates, setCertificates] = useState<IssuerCertificate[]>([]);
  const [selected, setSelected] = useState<IssuerCertificate | null>(null);
  const [reason, setReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["issuer-series-certificates"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_issuer_series_certificates", {
        p_series_id: null,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as IssuerCertificate[];
      setCertificates(rows);
      return rows;
    },
  });

  const revokeCertificate = async () => {
    const normalizedReason = normalizeRevocationReason(reason);
    if (!selected || !normalizedReason) {
      toast.error("Enter a clear revocation reason between 3 and 1000 characters.");
      return;
    }

    setIsRevoking(true);
    try {
      const { data, error } = await supabase.rpc("revoke_verified_series_certificate", {
        p_certificate_id: selected.id,
        p_reason: normalizedReason,
      });
      if (error) throw new Error(error.message);

      const revoked = data as IssuerCertificate;
      setCertificates((current) =>
        current.map((certificate) => (certificate.id === revoked.id ? revoked : certificate)),
      );
      setSelected(null);
      setReason("");
      toast.success("Certificate revoked and the student was notified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Certificate revocation failed.");
    } finally {
      setIsRevoking(false);
    }
  };

  if (isLoading || certificates.length === 0) return null;

  return (
    <section
      className="mx-auto max-w-7xl px-4 pb-8 md:px-6"
      aria-labelledby="issuer-certificate-controls"
    >
      <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-xs font-bold uppercase text-gray-600">Issuer controls</p>
            <h2 id="issuer-certificate-controls" className="font-display text-2xl font-bold">
              Event-series credentials
            </h2>
            <p className="mt-2 max-w-2xl font-mono text-xs text-gray-600">
              Revocation is permanent and immediately visible to public verifiers. Students receive
              an in-app notification with the reason.
            </p>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className={`flex flex-col gap-4 border-2 border-black p-4 md:flex-row md:items-center md:justify-between ${
                certificate.is_revoked ? "bg-red-50" : "bg-cream"
              }`}
            >
              <div>
                <p className="font-display text-lg font-bold">{certificate.series_name}</p>
                <p className="font-mono text-xs text-gray-700">
                  Recipient: <span className="font-bold">{certificate.user_name}</span> · Completed{" "}
                  {certificate.completion_date}
                </p>
                {certificate.is_revoked && (
                  <p className="mt-2 font-mono text-xs font-bold text-red-700">
                    Revoked: {certificate.revocation_reason || "No reason supplied."}
                  </p>
                )}
              </div>

              {certificate.is_revoked ? (
                <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-red-700">
                  <Ban className="h-4 w-4" aria-hidden="true" /> Revoked
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelected(certificate)}
                  className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-red-600 px-4 py-3 font-mono text-xs font-bold uppercase text-white hover:bg-red-700"
                >
                  <Ban className="h-4 w-4" aria-hidden="true" /> Revoke credential
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-dialog-title"
        >
          <div className="neu-border w-full max-w-lg bg-white p-6 shadow-[8px_8px_0_0_var(--color-ink)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <h3 id="revoke-dialog-title" className="font-display text-2xl font-bold">
                  Revoke this credential?
                </h3>
                <p className="mt-2 font-mono text-xs text-gray-700">
                  This cannot be undone from the client. The public verification page will show a
                  red REVOKED status.
                </p>
              </div>
            </div>

            <label
              className="mt-6 block font-mono text-xs font-bold uppercase"
              htmlFor="revocation-reason"
            >
              Reason for revocation
            </label>
            <textarea
              id="revocation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REVOCATION_REASON_MAX_LENGTH}
              rows={4}
              placeholder="Explain why the issuing organization invalidated this credential."
              className="mt-2 w-full border-2 border-black bg-cream p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-red-600"
            />
            <p className="mt-1 text-right font-mono text-[10px] text-gray-500">
              {reason.length}/1000
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReason("");
                }}
                className="neu-border px-4 py-3 font-mono text-xs font-bold uppercase hover:bg-gray-100"
                disabled={isRevoking}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void revokeCertificate()}
                disabled={isRevoking || !normalizeRevocationReason(reason)}
                className="neu-border neu-press inline-flex items-center gap-2 bg-red-600 px-4 py-3 font-mono text-xs font-bold uppercase text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                {isRevoking ? "Revoking..." : "Confirm revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
