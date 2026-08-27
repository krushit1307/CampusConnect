import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import FileText from "lucide-react/dist/esm/icons/file-text";
import PenLine from "lucide-react/dist/esm/icons/pen-line";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import { Button } from "@/components/ui/button";
import ConstitutionRatificationFlow from "@/components/ConstitutionRatificationFlow";

interface OutstandingItem {
  club_id: string;
  club_name: string;
  club_slug: string;
  club_logo_url: string | null;
  constitution_url: string | null;
  bylaws_version: number;
  role_id: string;
  role_title: string;
  permissions_level: number;
  signed: boolean;
  signed_bylaws_at: string | null;
}

interface ComplianceResponse {
  needs_compliance: boolean;
  outstanding: OutstandingItem[];
}

/**
 * Mandatory "Compliance Check" page (#3188).
 *
 * Club executives with an outstanding (unsigned) bylaws signature are
 * redirected here by ComplianceCheckGuard. They must:
 *   1. Scroll the constitution PDF all the way to the bottom, then
 *   2. Draw their signature on a touch-optimized canvas, then
 *   3. Confirm — the backend records the signature hash + timestamp.
 */
function ExecutiveComplianceCheckPage() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OutstandingItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sigCanvas = useRef<SignatureCanvas>(null);
  const pdfFrameRef = useRef<HTMLIFrameElement>(null);
  const scrollCheckTimer = useRef<number | null>(null);

  const active = items[activeIdx];

  // 1. Load outstanding compliance items.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/bylaws-compliance-status`;
      try {
        const res = await fetch(fnUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error("Failed to load compliance status");
        const body = (await res.json()) as ComplianceResponse;
        if (cancelled) return;
        setItems(body.outstanding.filter((item) => !item.signed));
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load compliance status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [navigate, supabase]);

  // 2. Load the active constitution PDF as a blob URL (CSP: object-src none,
  // frame-src restricted — blob: iframes are allowed by worker-src blob: and
  // the browser's own frame handling; we avoid loading the Supabase host in
  // an iframe entirely).
  useEffect(() => {
    if (!active) return;
    if (!active.constitution_url) {
      setPdfError("This club has not uploaded a constitution yet.");
      setPdfLoaded(false);
      return;
    }

    let cancelled = false;
    setPdfUrl(null);
    setPdfLoaded(false);
    setPdfError(null);
    setScrolledToBottom(false);

    const loadPdf = async () => {
      try {
        const res = await fetch(active.constitution_url!);
        if (!res.ok) throw new Error("Failed to download constitution PDF");
        const blob = await res.blob();
        if (cancelled) return;
        setPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : "Failed to load constitution PDF");
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      // Revoke previous object URL on cleanup / item change.
    };
  }, [active]);

  // Revoke object URLs when the component unmounts or the URL changes.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // 3. Detect scroll-to-bottom inside the PDF iframe.
  const handlePdfLoad = useCallback(() => {
    setPdfLoaded(true);
    const frame = pdfFrameRef.current;

    const check = () => {
      try {
        const doc = frame?.contentDocument || frame?.contentWindow?.document;
        if (!doc) return;
        const body = doc.body;
        const html = doc.documentElement;
        const scrolled = body.scrollTop || html.scrollTop || 0;
        const maxScroll = Math.max(
          body.scrollHeight,
          html.scrollHeight,
          body.offsetHeight,
          html.offsetHeight,
        );
        const client = html.clientHeight || body.clientHeight || 0;
        if (maxScroll - (scrolled + client) < 40) {
          setScrolledToBottom(true);
        }
      } catch {
        // Cross-origin iframe access is blocked; rely on the confirm checkbox.
      }
    };

    // Poll until the PDF internal document is available.
    scrollCheckTimer.current = window.setInterval(check, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollCheckTimer.current) window.clearInterval(scrollCheckTimer.current);
    };
  }, []);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const confirmSigned = async () => {
    if (!active) return;
    if (!scrolledToBottom && !pdfError) {
      toast.error("Please scroll to the bottom of the constitution before signing.");
      return;
    }
    if (sigCanvas.current?.isEmpty()) {
      toast.error("Please draw your signature before submitting.");
      return;
    }

    setSigning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const signatureBase64 = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/submit-bylaws-signature`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          club_id: active.club_id,
          role_id: active.role_id,
          bylaws_version: active.bylaws_version,
          signature_base64: signatureBase64,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to submit signature");
      }

      toast.success(`Signed ${active.club_name} bylaws (v${active.bylaws_version})`);

      if (activeIdx < items.length - 1) {
        // Move to the next outstanding club.
        setActiveIdx((prev) => prev + 1);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit signature");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream p-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="mt-4 font-display text-2xl font-bold text-neutral-900">
          Compliance Complete
        </h1>
        <p className="mt-2 max-w-md text-neutral-600">
          You've signed all outstanding club constitutions. Your executive access is now active.
        </p>
        <Button
          className="mt-6 neu-border neu-shadow bg-lime px-6 py-3 font-medium"
          onClick={() => navigate(redirectTo, { replace: true })}
        >
          Continue to CampusConnect
        </Button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream p-6 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl font-bold text-neutral-900">
          You're all caught up
        </h1>
        <p className="mt-2 max-w-md text-neutral-600">
          No outstanding bylaws signatures. Redirecting…
        </p>
        <Button
          className="mt-6 neu-border neu-shadow bg-lime px-6 py-3 font-medium"
          onClick={() => navigate(redirectTo, { replace: true })}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-neutral-500">
              Compliance Check · {activeIdx + 1} of {items.length}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold text-neutral-900">
              Sign {active.club_name} Bylaws
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Version {active.bylaws_version} · {active.role_title}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-500"
            onClick={() => {
              void supabase.auth.signOut();
              navigate("/auth", { replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        {/* Step 1: Read the constitution */}
        <div className="mt-8 rounded-lg border-2 border-neutral-900 bg-white p-6 neu-shadow">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-neutral-700" />
            <h2 className="font-display text-lg font-bold text-neutral-900">
              Step 1 — Read the constitution
            </h2>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Scroll to the very bottom of the document to confirm you've read it in full.
          </p>

          {pdfError ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {pdfError}
            </div>
          ) : (
            <div className="mt-4">
              {!pdfUrl && (
                <div className="flex h-96 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              )}
              {pdfUrl && (
                <iframe
                  ref={pdfFrameRef}
                  src={pdfUrl}
                  title={`${active.club_name} constitution`}
                  className="h-[60vh] w-full rounded-lg border border-neutral-200 bg-neutral-50"
                  onLoad={handlePdfLoad}
                />
              )}
              {pdfLoaded && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {scrolledToBottom ? (
                    <span className="inline-flex items-center gap-1 font-medium text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> You've reached the bottom
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-neutral-500">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Waiting for you to scroll to
                      the bottom…
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Draw signature */}
        <div className="mt-8 rounded-lg border-2 border-neutral-900 bg-white p-6 neu-shadow">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-neutral-700" />
            <h2 className="font-display text-lg font-bold text-neutral-900">
              Step 2 — Sign electronically
            </h2>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Draw your signature in the box below. Works with mouse or finger on touch screens.
          </p>

          <div className="relative mt-4">
            <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-neutral-300">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: "h-52 w-full cursor-crosshair touch-none rounded-lg bg-white",
                }}
              />
              <button
                type="button"
                onClick={clearSignature}
                className="absolute right-2 top-2 rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-700"
              >
                Clear
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              By signing, you agree that you have read and understood the club's constitution and
              bylaws.
            </p>
          </div>

          <Button
            className="mt-6 w-full neu-border neu-shadow bg-lime py-3 font-medium sm:w-auto"
            onClick={() => void confirmSigned()}
            disabled={signing || (!scrolledToBottom && !pdfError)}
          >
            {signing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Sign &amp; Submit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceCheckPage() {
  const [searchParams] = useSearchParams();
  if (searchParams.get("mode") === "ratification") {
    return <ConstitutionRatificationFlow />;
  }
  return <ExecutiveComplianceCheckPage />;
}
