import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  CONSTITUTION_RATIFICATION_COPY,
  getLegalNameValidationMessage,
} from "@/lib/constitutionRatification";

interface RatificationItem {
  club_id: string;
  club_name: string;
  club_slug: string;
  constitution_url: string | null;
  constitution_version: number;
}

interface RatificationResponse {
  needs_ratification: boolean;
  outstanding: RatificationItem[];
}

function getConstitutionUrl(fileUrl: string) {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  return supabase.storage.from("club_documents").getPublicUrl(fileUrl).data.publicUrl;
}

export default function ConstitutionRatificationFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RatificationItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [documentLoaded, setDocumentLoaded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [signing, setSigning] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const active = items[activeIndex];
  const documentUrl = active?.constitution_url ? getConstitutionUrl(active.constitution_url) : null;

  useEffect(() => {
    let cancelled = false;

    const loadRatificationStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/constitution-ratification-status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!response.ok) throw new Error("Failed to load constitution ratification status.");
        const body = (await response.json()) as RatificationResponse;
        if (!cancelled) setItems(body.outstanding ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load ratification status.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRatificationStatus();
    return () => {
      cancelled = true;
    };
  }, [navigate, supabase]);

  useEffect(() => {
    setDocumentLoaded(false);
    setReviewed(false);
    setLegalName("");
    setDocumentError(null);
  }, [activeIndex]);

  const submitRatification = async () => {
    if (!active) return;
    if (!documentLoaded) {
      toast.error("Please wait for the constitution to finish loading before continuing.");
      return;
    }
    if (!reviewed) {
      toast.error("Please confirm that you reviewed the constitution.");
      return;
    }
    const nameError = getLegalNameValidationMessage(legalName);
    if (nameError) {
      toast.error(nameError);
      return;
    }

    setSigning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/submit-constitution-ratification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            club_id: active.club_id,
            constitution_version: active.constitution_version,
            legal_name: legalName,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to submit ratification.");
      }

      toast.success(`${active.club_name} constitution ratified.`);
      if (activeIndex < items.length - 1) {
        setActiveIndex((index) => index + 1);
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit ratification.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-700" aria-label="Loading" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-6">
        <div className="w-full max-w-lg border-4 border-black bg-white p-8 text-center shadow-[8px_8px_0_0_#000]">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
          <h1 className="mt-4 font-display text-3xl font-black uppercase">All caught up</h1>
          <p className="mt-3 font-mono text-sm">
            No club constitution ratifications are waiting for you.
          </p>
          <button
            type="button"
            className="mt-6 neu-border neu-press bg-lime px-5 py-3 font-mono text-sm font-bold uppercase"
            onClick={() => navigate(redirectTo, { replace: true })}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8">
      <div
        className="mx-auto flex min-h-full w-full max-w-5xl flex-col border-4 border-black bg-cream shadow-[10px_10px_0_0_#000]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="constitution-ratification-title"
        data-testid="constitution-ratification-dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b-4 border-black bg-yellow-300 p-5 sm:p-7">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider">
              Membership compliance · {activeIndex + 1} of {items.length}
            </p>
            <h1
              id="constitution-ratification-title"
              className="mt-2 font-display text-2xl font-black uppercase sm:text-4xl"
            >
              {CONSTITUTION_RATIFICATION_COPY.title}
            </h1>
          </div>
          <button
            type="button"
            className="neu-border bg-white p-2"
            onClick={() => {
              void supabase.auth.signOut();
              navigate("/auth", { replace: true });
            }}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr]">
          <section className="min-w-0">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6" />
              <div>
                <p className="font-mono text-xs font-bold uppercase">Club constitution</p>
                <h2 className="font-display text-2xl font-black uppercase">{active.club_name}</h2>
              </div>
            </div>
            <p className="mt-2 font-mono text-sm">
              Current version: v{active.constitution_version}
            </p>

            <div className="mt-5 border-2 border-black bg-white p-2">
              {documentUrl ? (
                <iframe
                  src={documentUrl}
                  title={`${active.club_name} constitution, version ${active.constitution_version}`}
                  className="h-[55vh] min-h-[420px] w-full bg-neutral-100"
                  onLoad={() => setDocumentLoaded(true)}
                  onError={() => {
                    setDocumentError("The constitution document could not be loaded.");
                    setDocumentLoaded(false);
                  }}
                />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-8 text-center font-mono text-sm">
                  The club has not provided a constitution document for this version.
                </div>
              )}
            </div>
            {documentError && (
              <p className="mt-2 flex items-center gap-2 font-mono text-sm font-bold text-red-700">
                <AlertCircle className="h-4 w-4" /> {documentError}
              </p>
            )}
          </section>

          <section className="flex flex-col border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] sm:p-6">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-600">
              Required action
            </p>
            <h2 className="mt-2 font-display text-2xl font-black uppercase">Review and agree</h2>
            <p className="mt-3 font-mono text-sm leading-relaxed">
              {CONSTITUTION_RATIFICATION_COPY.description}
            </p>

            <label className="mt-6 flex cursor-pointer items-start gap-3 border-2 border-black bg-lime/30 p-4 font-mono text-sm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
                className="mt-1 h-5 w-5 accent-black"
                disabled={!documentLoaded}
              />
              <span>{CONSTITUTION_RATIFICATION_COPY.reviewLabel}</span>
            </label>

            <label className="mt-6 font-mono text-sm font-bold" htmlFor="legal-name">
              {CONSTITUTION_RATIFICATION_COPY.legalNameLabel}
              <input
                id="legal-name"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                placeholder="e.g. Alex Morgan"
                autoComplete="name"
                className="mt-2 w-full border-2 border-black bg-white px-3 py-3 font-mono text-base outline-none focus:bg-yellow-100"
                disabled={!documentLoaded || signing}
              />
            </label>
            <p className="mt-2 font-mono text-xs text-neutral-600">
              {CONSTITUTION_RATIFICATION_COPY.legalNameHint}
            </p>

            <div className="mt-auto pt-8">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 neu-border neu-press bg-blue-300 px-5 py-3 font-mono text-sm font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void submitRatification()}
                disabled={signing || !documentLoaded || !reviewed}
              >
                {signing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {signing ? "Saving…" : CONSTITUTION_RATIFICATION_COPY.submit}
              </button>
              <p className="mt-3 text-center font-mono text-xs text-neutral-500">
                Your timestamp, IP address, and audit hash are retained for compliance records.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
