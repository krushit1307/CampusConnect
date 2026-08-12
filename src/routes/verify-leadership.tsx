import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import ShieldX from "lucide-react/dist/esm/icons/shield-x";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import Award from "lucide-react/dist/esm/icons/award";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import FileText from "lucide-react/dist/esm/icons/file-text";
import { formatStandardDate } from "@/utils/dateUtils";

interface VerificationResult {
  valid: boolean;
  status: "verified" | "valid" | "pending_anchor" | "pending" | "tampered" | "unverified" | "not_found" | "bad_request" | "error";
  message?: string;
  error?: string;
  certificate?: {
    id: string;
    certificateType?: "attendance" | "leadership";
    verificationHash: string | null;
    issuedAt: string | null;
    certificateUrl: string | null;
    event: string | null;
    eventDate: string | null;
    roleTitle?: string | null;
    tenureStart?: string | null;
    tenureEnd?: string | null;
    club: string | null;
    holder: string | null;
  };
  proof?: {
    merkleRoot: string | null;
    merklePathLength: number;
    anchorDay: string | null;
    anchorTxHash: string | null;
    anchorBlock: number | null;
    onChain: boolean | null;
  };
}

const VERIFY_FN_URL = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/verify-certificate`;

async function fetchVerificationResult(rawInput: string): Promise<VerificationResult> {
  const cleanInput = rawInput.trim();
  let queryParam = "";

  if (cleanInput.includes("?")) {
    queryParam = cleanInput.split("?")[1];
  } else if (cleanInput.length > 40 && !cleanInput.includes("-")) {
    queryParam = `hash=${encodeURIComponent(cleanInput)}`;
  } else {
    queryParam = `hash=${encodeURIComponent(cleanInput)}&cert=${encodeURIComponent(cleanInput)}`;
  }

  const res = await fetch(`${VERIFY_FN_URL}?${queryParam}`);
  if (!res.ok) {
    throw new Error(`Verification service error (${res.status})`);
  }
  return (await res.json()) as VerificationResult;
}

function LeadershipResultCard({ result }: { result: VerificationResult }) {
  const { certificate, proof } = result;
  const isValid = result.valid;

  if (!isValid || result.status === "not_found" || result.status === "bad_request" || result.status === "tampered") {
    return (
      <div className="neu-border bg-white p-6 md:p-8 animate-fade-in-up">
        <div className="neu-border bg-peach p-5 flex items-start gap-4">
          <div className="neu-border bg-white p-2.5 shrink-0">
            <ShieldX className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <p className="eyebrow font-bold text-xs uppercase text-red-700 mb-1">
              Invalid or Not Found
            </p>
            <p className="font-display text-xl font-bold text-black leading-tight">
              {result.status === "tampered"
                ? "Leadership Certificate Record Tampered"
                : "No Valid Leadership Certificate Found"}
            </p>
            <p className="font-mono text-xs text-gray-800 mt-2">
              {result.message || result.error || "The provided verification hash or certificate ID does not match any authentic leadership record in our database."}
            </p>
          </div>
        </div>

        <div className="mt-6 font-mono text-xs text-gray-600 space-y-2">
          <p>
            Please verify that you have entered or opened the correct verification link format:
          </p>
          <code className="block neu-border bg-amber-100 p-3 font-mono text-xs text-black font-bold">
            /verify-leadership?hash=&lt;verification_hash&gt;
          </code>
        </div>
      </div>
    );
  }

  const roleTitle = certificate?.roleTitle || "Officer / Leader";
  const clubName = certificate?.club || "CampusConnect Club";
  const tenureStartFormatted = certificate?.tenureStart
    ? formatStandardDate(certificate.tenureStart, "MMMM d, yyyy")
    : "—";
  const tenureEndFormatted = certificate?.tenureEnd
    ? formatStandardDate(certificate.tenureEnd, "MMMM d, yyyy")
    : "Present";

  return (
    <div className="neu-border bg-white p-6 md:p-8 animate-fade-in-up">
      {/* Header Badge */}
      <div className="neu-border bg-amber-300 p-5 flex items-start gap-4 mb-6">
        <div className="neu-border bg-white p-2.5 shrink-0">
          <Award className="h-7 w-7 text-black" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow font-bold text-xs uppercase bg-black text-amber-300 px-2 py-0.5 neu-border">
              Official Leadership Record
            </span>
            <span className="font-mono text-xs font-bold text-amber-950 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Valid & Verified
            </span>
          </div>
          <p className="font-display text-2xl font-bold text-black leading-tight">
            Authentic Certificate of Leadership
          </p>
          <p className="font-mono text-xs text-gray-800 mt-1">
            {result.message || "This leadership certificate has been cryptographically issued and verified."}
          </p>
        </div>
      </div>

      {/* Primary Details Grid */}
      {certificate && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="neu-border bg-amber-50 p-5 space-y-3 font-mono text-xs">
            <h3 className="font-display text-sm font-bold border-b-2 border-black pb-2 uppercase tracking-wide">
              Leader Details
            </h3>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Student Name</span>
              <span className="font-bold text-black text-right">{certificate.holder || "Student Leader"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Leadership Role</span>
              <span className="font-bold text-amber-900 text-right">{roleTitle}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Organization / Club</span>
              <span className="font-bold text-black text-right">{clubName}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Tenure Start Date</span>
              <span className="font-bold text-black">{tenureStartFormatted}</span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="font-bold text-gray-600">Tenure End Date</span>
              <span className="font-bold text-black">{tenureEndFormatted}</span>
            </div>
          </div>

          <div className="neu-border bg-amber-50 p-5 space-y-3 font-mono text-xs">
            <h3 className="font-display text-sm font-bold border-b-2 border-black pb-2 uppercase tracking-wide">
              Verification Metadata
            </h3>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Verification Status</span>
              <span className="font-bold uppercase text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded">
                {result.status}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Verification Hash</span>
              <span className="select-all font-mono font-bold text-black truncate max-w-[160px]">
                {certificate.verificationHash || "—"}
              </span>
            </div>
            {certificate.issuedAt && (
              <div className="flex justify-between border-b border-black/10 pb-1.5">
                <span className="font-bold text-gray-600">Issued On</span>
                <span className="font-bold text-black">
                  {formatStandardDate(certificate.issuedAt, "MMMM d, yyyy")}
                </span>
              </div>
            )}
            {proof?.merkleRoot && (
              <div className="flex justify-between pb-1">
                <span className="font-bold text-gray-600">Merkle Root</span>
                <span className="truncate max-w-[140px] font-mono text-gray-700 font-bold">
                  {proof.merkleRoot}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Action */}
      {certificate?.certificateUrl && (
        <div className="mt-6 flex justify-end">
          <a
            href={certificate.certificateUrl}
            target="_blank"
            rel="noreferrer"
            className="neu-border neu-press bg-lime px-4 py-2.5 font-mono text-xs font-bold uppercase inline-flex items-center gap-2"
          >
            <FileText className="h-4 w-4" /> Download Official PDF
          </a>
        </div>
      )}
    </div>
  );
}

export default function VerifyLeadership() {
  const [searchParams] = useSearchParams();
  const initialHash = searchParams.get("hash") || searchParams.get("cert") || searchParams.get("id") || "";

  const [inputHash, setInputHash] = useState(initialHash);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(Boolean(initialHash));

  useEffect(() => {
    if (!initialHash) return;

    let isMounted = true;
    setLoading(true);

    fetchVerificationResult(initialHash)
      .then((data) => {
        if (isMounted) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setResult({
            valid: false,
            status: "error",
            error: err instanceof Error ? err.message : "Failed to verify certificate",
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialHash]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = inputHash.trim();
    if (!clean) return;

    setLoading(true);
    fetchVerificationResult(clean)
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((err) => {
        setResult({
          valid: false,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to verify certificate",
        });
        setLoading(false);
      });
  };

  return (
    <SiteShell>
      <section className="bg-amber-300 px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <span className="eyebrow font-bold text-xs uppercase bg-black text-amber-300 px-2 py-0.5 neu-border">
            Public Verification Portal
          </span>
          <h1 className="font-display text-3xl font-extrabold text-black md:text-5xl">
            Leadership Certificate Verification
          </h1>
          <p className="font-mono text-sm text-gray-800 max-w-2xl mx-auto">
            Verify the authentic leadership status, role tenure, and cryptographic proof of any CampusConnect Student Leader.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="text"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value)}
              placeholder="Paste Hash or Certificate ID..."
              className="neu-border bg-white p-3 font-mono text-xs w-full focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="neu-border neu-press bg-black text-white px-6 py-3 font-mono text-xs font-bold uppercase shrink-0 flex items-center justify-center gap-2 hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Verify
            </button>
          </form>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="neu-border bg-white p-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600" />
            <p className="font-mono text-xs text-gray-600 font-bold uppercase">
              Verifying Leadership Record...
            </p>
          </div>
        ) : result ? (
          <LeadershipResultCard result={result} />
        ) : (
          <div className="neu-border bg-white p-8 text-center space-y-3 font-mono text-xs text-gray-600">
            <Award className="h-8 w-8 mx-auto text-amber-500" />
            <p className="font-bold text-black text-sm">No Certificate Loaded</p>
            <p>Enter a verification hash or certificate ID above to verify leadership tenure.</p>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
