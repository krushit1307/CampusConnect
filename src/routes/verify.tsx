import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import ShieldX from "lucide-react/dist/esm/icons/shield-x";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import Award from "lucide-react/dist/esm/icons/award";
import FileText from "lucide-react/dist/esm/icons/file-text";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
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

function ResultCard({ result }: { result: VerificationResult }) {
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
                ? "Certificate Record Tampered"
                : "No Valid Certificate Found"}
            </p>
            <p className="font-mono text-xs text-gray-800 mt-2">
              {result.message || result.error || "The provided verification hash or certificate ID does not match any authentic record in our database."}
            </p>
          </div>
        </div>

        <div className="mt-6 font-mono text-xs text-gray-600 space-y-2">
          <p>
            Please verify that you have entered or opened the correct verification link format:
          </p>
          <code className="block neu-border bg-amber-100 p-3 font-mono text-xs text-black font-bold">
            /verify?hash=&lt;verification_hash&gt;
          </code>
        </div>
      </div>
    );
  }

  const isLeadership = certificate?.certificateType === "leadership" || Boolean(certificate?.roleTitle);

  return (
    <div className="neu-border bg-white p-6 md:p-8 animate-fade-in-up">
      {/* Header Badge */}
      <div className={`neu-border p-5 flex items-start gap-4 mb-6 ${isLeadership ? "bg-amber-300" : "bg-lime"}`}>
        <div className="neu-border bg-white p-2.5 shrink-0">
          {isLeadership ? <Award className="h-7 w-7 text-black" /> : <ShieldCheck className="h-7 w-7 text-black" />}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow font-bold text-xs uppercase bg-black text-white px-2 py-0.5 neu-border">
              {isLeadership ? "Leadership Record" : "Attendance Record"}
            </span>
            <span className="font-mono text-xs font-bold text-green-900 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Valid & Verified
            </span>
          </div>
          <p className="font-display text-2xl font-bold text-black leading-tight">
            {isLeadership ? "Authentic Certificate of Leadership" : "Authentic Certificate of Attendance"}
          </p>
          <p className="font-mono text-xs text-gray-800 mt-1">
            {result.message || "This certificate has been issued and verified on CampusConnect."}
          </p>
        </div>
      </div>

      {/* Primary Details Grid */}
      {certificate && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="neu-border bg-cream p-5 space-y-3 font-mono text-xs">
            <h3 className="font-display text-sm font-bold border-b-2 border-black pb-2 uppercase tracking-wide">
              {isLeadership ? "Leader Details" : "Attendee Information"}
            </h3>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Student Name</span>
              <span className="font-bold text-black text-right">{certificate.holder || "Student"}</span>
            </div>
            {isLeadership ? (
              <>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="font-bold text-gray-600">Leadership Role</span>
                  <span className="font-bold text-amber-900 text-right">{certificate.roleTitle || "Officer"}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="font-bold text-gray-600">Club Name</span>
                  <span className="font-bold text-black text-right">{certificate.club || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="font-bold text-gray-600">Start Date</span>
                  <span className="font-bold text-black">
                    {certificate.tenureStart
                      ? formatStandardDate(certificate.tenureStart, "MMMM d, yyyy")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="font-bold text-gray-600">End Date</span>
                  <span className="font-bold text-black">
                    {certificate.tenureEnd
                      ? formatStandardDate(certificate.tenureEnd, "MMMM d, yyyy")
                      : "Present"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="font-bold text-gray-600">Event Title</span>
                  <span className="font-bold text-black text-right max-w-[200px] truncate">{certificate.event || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 pb-1.5">
                  <span className="font-bold text-gray-600">Event Date</span>
                  <span className="font-bold text-black">
                    {certificate.eventDate
                      ? formatStandardDate(certificate.eventDate, "MMMM d, yyyy")
                      : "—"}
                  </span>
                </div>
                {certificate.club && (
                  <div className="flex justify-between pb-1">
                    <span className="font-bold text-gray-600">Organizing Club</span>
                    <span className="font-bold text-black">{certificate.club}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="neu-border bg-cream p-5 space-y-3 font-mono text-xs">
            <h3 className="font-display text-sm font-bold border-b-2 border-black pb-2 uppercase tracking-wide">
              Verification Metadata
            </h3>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Verification Status</span>
              <span className="font-bold uppercase text-green-700 bg-lime/40 px-1.5 py-0.5 rounded">
                {result.status}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Verification Hash</span>
              <span className="select-all font-mono font-bold text-black truncate max-w-[150px]">
                {certificate.verificationHash || "—"}
              </span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1.5">
              <span className="font-bold text-gray-600">Certificate ID</span>
              <span className="select-all font-mono font-bold text-black truncate max-w-[150px]">
                {certificate.id}
              </span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="font-bold text-gray-600">Issued On</span>
              <span className="font-bold text-black">
                {certificate.issuedAt
                  ? formatStandardDate(certificate.issuedAt, "MMM d, yyyy")
                  : "—"}
              </span>
            </div>
            {certificate.club && (
              <div className="flex justify-between pb-1">
                <span className="font-bold text-gray-600">Organizing Club</span>
                <span className="font-bold text-black">{certificate.club}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Footer */}
      {certificate?.certificateUrl && certificate.certificateUrl !== "pending" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t-2 border-dashed border-black">
          <a
            href={certificate.certificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="neu-border neu-press inline-flex items-center gap-2 bg-black text-cream hover:bg-lime hover:text-black py-3 px-6 font-mono text-xs font-bold uppercase transition-colors cursor-pointer"
          >
            <FileText className="h-4 w-4" /> Download Official PDF Certificate
          </a>
          {proof?.anchorTxHash && (
            <a
              href={`https://polygonscan.com/tx/${proof.anchorTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-bold underline hover:text-blue-700"
            >
              View On-Chain Proof ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyCertificate() {
  const [searchParams] = useSearchParams();
  const hashParam = searchParams.get("hash");
  const certParam = searchParams.get("cert") || searchParams.get("id");
  const initialQuery = hashParam || certParam || "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) {
      setLoading(true);
      setError(null);
      fetchVerificationResult(initialQuery)
        .then(setResult)
        .catch((err) => setError(err instanceof Error ? err.message : "Verification failed."))
        .finally(() => setLoading(false));
    }
  }, [initialQuery]);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    const raw = inputValue.trim();
    if (!raw) {
      setError("Please enter a verification hash or certificate ID.");
      setResult(null);
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await fetchVerificationResult(raw);
      setResult(data);
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
              <p className="font-mono text-sm text-gray-800 mt-2 max-w-xl">
                Verify the authenticity of any CampusConnect attendance certificate.
                Enter a verification hash or certificate ID below to check its validity.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="mt-8 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter verification hash or certificate ID (e.g. 0x123... or cert ID)"
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
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying certificate hash...
              </div>
            )}
            {error && (
              <div className="neu-border bg-peach p-5 font-mono text-sm font-bold flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {result && !loading && <ResultCard result={result} />}
          </div>

          <div className="mt-10 border-t-2 border-dashed border-black pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-mono text-xs text-gray-700">
              Students can view earned certificates in their{" "}
              <Link to="/certificates" className="underline font-bold">
                certificates locker
              </Link>.
            </p>
            <p className="font-mono text-[10px] font-bold uppercase bg-white neu-border px-3 py-1.5">
              CampusConnect Verifiable Credentials
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
