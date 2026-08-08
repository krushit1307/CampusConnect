import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { ShieldCheck, ShieldX, Loader2, Search, Award, ExternalLink, FileText } from "lucide-react";
import { formatStandardDate } from "@/utils/dateUtils";

interface VerificationResult {
  valid: boolean;
  status: "verified" | "pending_anchor" | "tampered" | "unverified" | "not_found" | "error";
  message?: string;
  error?: string;
  certificate?: {
    id: string;
    verificationHash: string | null;
    issuedAt: string | null;
    certificateUrl: string | null;
    event: string | null;
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
    contractAddress: string | null;
  };
}

const VERIFY_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-certificate`;

async function verifyCertificate(query: string): Promise<VerificationResult> {
  const target = query.includes("?") ? query.split("?")[1] : query;
  const res = await fetch(`${VERIFY_FN_URL}?${target}`);
  if (!res.ok) {
    throw new Error(`Verification service error (${res.status})`);
  }
  return (await res.json()) as VerificationResult;
}

function ResultCard({ result }: { result: VerificationResult }) {
  const { certificate, proof } = result;
  const verified = result.valid;

  return (
    <div className="neu-border bg-white p-6 md:p-8 animate-fade-in-up">
      <div
        className={`neu-border p-5 flex items-start gap-4 ${
          verified ? "bg-lime" : result.status === "pending_anchor" ? "bg-amber-200" : "bg-peach"
        }`}
      >
        <div className="neu-border bg-white p-2.5 shrink-0">
          {verified ? <ShieldCheck className="h-7 w-7" /> : <ShieldX className="h-7 w-7" />}
        </div>
        <div>
          <p className="eyebrow font-bold text-xs uppercase mb-1">
            {verified ? "Authentic Certificate" : "Verification Result"}
          </p>
          <p className="font-display text-xl font-bold leading-tight">
            {verified ? "Verified on the blockchain" : result.status.replace(/_/g, " ")}
          </p>
          <p className="font-mono text-xs text-gray-700 mt-1">{result.message || result.error}</p>
        </div>
      </div>

      {certificate && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Holder</span>
              <span>{certificate.holder || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Event</span>
              <span className="text-right max-w-[200px]">{certificate.event || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Club</span>
              <span>{certificate.club || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Issued</span>
              <span>
                {certificate.issuedAt
                  ? formatStandardDate(certificate.issuedAt, "MMM d, yyyy")
                  : "—"}
              </span>
            </div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Certificate ID</span>
              <span className="select-all truncate max-w-[160px]">{certificate.id}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Merkle Root</span>
              <span className="select-all truncate max-w-[160px]">{proof?.merkleRoot || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">Anchor Day</span>
              <span>{proof?.anchorDay || "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span className="font-bold uppercase">On-Chain</span>
              <span>{proof?.onChain === null ? "not checked" : proof.onChain ? "yes" : "no"}</span>
            </div>
            {proof?.anchorTxHash && (
              <div className="flex items-center justify-between border-b border-black/10 pb-1">
                <span className="font-bold uppercase">Tx</span>
                <a
                  href={`https://polygonscan.com/tx/${proof.anchorTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-700 flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {certificate?.certificateUrl && (
        <a
          href={certificate.certificateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border neu-press mt-6 inline-flex items-center gap-2 bg-black text-cream hover:bg-lime hover:text-black py-3 px-6 font-mono text-xs font-bold uppercase transition-colors cursor-pointer"
        >
          <FileText className="h-4 w-4" /> View Certificate PDF
        </a>
      )}
    </div>
  );
}

export default function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("cert") || searchParams.get("hash") || "";
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) {
      setLoading(true);
      verifyCertificate(initialQuery)
        .then(setResult)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [initialQuery]);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const raw = inputValue.trim();
      if (!raw) {
        setError("Enter a certificate ID or verification hash.");
        return;
      }
      const target = raw.includes("?") ? raw.split("?")[1] : `cert=${encodeURIComponent(raw)}`;
      setQuery(target);
      setResult(await verifyCertificate(target));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteShell>
      <section className="bg-lime px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-4">
            <div className="neu-border bg-white p-3">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <p className="eyebrow font-bold text-xs uppercase mb-1">CampusConnect</p>
              <h1 className="font-display text-3xl md:text-4xl font-bold">
                Certificate Verification
              </h1>
              <p className="font-mono text-sm text-gray-700 mt-2 max-w-xl">
                Every certificate hash is anchored to the Polygon blockchain in daily Merkle
                batches. Paste a certificate ID, verification hash, or full proof URL below to
                verify its authenticity mathematically — no account required.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="mt-8 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste certificate ID, hash, or /verify?cert=... URL"
              className="neu-border flex-1 bg-white px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
            <button
              type="submit"
              disabled={loading}
              className="neu-border neu-press bg-black text-cream hover:bg-sky hover:text-black py-3 px-6 font-mono text-xs font-bold uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Verify
            </button>
          </form>

          <div className="mt-8 space-y-6">
            {loading && (
              <div className="neu-border bg-white p-6 font-mono text-sm text-gray-600 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying against the blockchain...
              </div>
            )}
            {error && (
              <div className="neu-border bg-peach p-5 font-mono text-sm font-bold">{error}</div>
            )}
            {result && !loading && <ResultCard result={result} />}
          </div>

          <div className="mt-10 border-t-2 border-dashed border-black pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-mono text-xs text-gray-600">
              Holders can find their proof URL in the{" "}
              <Link to="/certificates" className="underline font-bold">
                certificates
              </Link>{" "}
              section.
            </p>
            <p className="font-mono text-[10px] font-bold uppercase bg-white neu-border px-3 py-1.5">
              Powered by Polygon · Merkle anchored
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
