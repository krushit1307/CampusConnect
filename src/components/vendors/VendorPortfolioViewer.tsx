import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Music2, Star, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { normalizeVendorPortfolio, type VendorPortfolio } from "@/lib/vendorPortfolio";
import type { RfpBid } from "@/lib/vendorRfp";

type PortfolioResult = {
  bid_id: string;
  vendor_user_id: string | null;
  vendor_name: string;
  vendor_email: string;
  vendor_portfolio: unknown;
  average_rating: number | string | null;
  rating_count: number | string | null;
};

export function VendorPortfolioViewer({
  bid,
  onClose,
}: {
  bid: RfpBid | null;
  onClose: () => void;
}) {
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!bid) {
      setResult(null);
      return;
    }
    if (!bid.vendor_user_id) {
      setResult({
        bid_id: bid.id,
        vendor_user_id: null,
        vendor_name: bid.vendor_name,
        vendor_email: bid.vendor_email,
        vendor_portfolio: null,
        average_rating: 0,
        rating_count: 0,
      });
      return;
    }
    let active = true;
    setIsLoading(true);
    void supabase
      .rpc("get_vendor_portfolio_for_bid", { p_bid_id: bid.id })
      .then(({ data, error }) => {
        if (!active) return;
        setIsLoading(false);
        if (error) {
          toast.error(error.message || "Could not load vendor portfolio.");
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        setResult((row as PortfolioResult | undefined) ?? null);
      });
    return () => {
      active = false;
    };
  }, [bid, supabase]);

  useEffect(() => {
    if (!bid) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bid, onClose]);

  if (!bid) return null;
  const portfolio: VendorPortfolio = normalizeVendorPortfolio(result?.vendor_portfolio);
  const rating = Number(result?.average_rating ?? 0);
  const reviewCount = Number(result?.rating_count ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-portfolio-title"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border-2 border-black bg-cream shadow-[8px_8px_0_0_#000]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b-2 border-black bg-purple-200 p-5">
          <div>
            <p className="font-mono text-xs font-bold uppercase text-purple-900">
              Vendor portfolio · bid {bid.id.slice(0, 8)}
            </p>
            <h2
              id="vendor-portfolio-title"
              className="mt-1 font-display text-3xl font-black uppercase"
            >
              {result?.vendor_name || bid.vendor_name}
            </h2>
            <a
              href={`mailto:${result?.vendor_email || bid.vendor_email}`}
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs underline"
            >
              {result?.vendor_email || bid.vendor_email} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close portfolio"
            className="border-2 border-black bg-white p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-16 font-mono text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading portfolio…
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="border-2 border-black bg-white p-4">
                <p className="font-display text-xl font-black">
                  {portfolio.tagline || "Student vendor profile"}
                </p>
                {portfolio.specialties.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {portfolio.specialties.map((specialty) => (
                      <span
                        key={specialty}
                        className="border-2 border-black bg-lime-300 px-2 py-1 font-mono text-[10px] font-bold uppercase"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-2 border-black bg-yellow-300 p-4 text-center">
                <p className="font-mono text-[10px] font-bold uppercase">CampusConnect rating</p>
                <p className="mt-1 font-display text-4xl font-black">
                  {rating.toFixed(1)}
                  <span className="text-xl">/5</span>
                </p>
                <div
                  className="flex justify-center"
                  aria-label={`${rating.toFixed(1)} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= Math.round(rating) ? "fill-black" : ""}`}
                    />
                  ))}
                </div>
                <p className="mt-1 font-mono text-[10px]">
                  {reviewCount} completed gig review{reviewCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {portfolio.audio_embeds.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 font-display text-xl font-black uppercase">
                  <Music2 className="h-5 w-5" /> Audio samples
                </h3>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  {portfolio.audio_embeds.map((sample) => (
                    <div key={sample.embedUrl} className="border-2 border-black bg-white p-3">
                      <p className="mb-2 font-mono text-xs font-bold uppercase">
                        {sample.title || sample.provider}
                      </p>
                      <iframe
                        src={sample.embedUrl}
                        title={sample.title || `${sample.provider} audio sample`}
                        loading="lazy"
                        className="h-40 w-full border border-black"
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      />
                      <a
                        href={sample.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] underline"
                      >
                        Open original <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {portfolio.gallery.length > 0 && (
              <section>
                <h3 className="font-display text-xl font-black uppercase">Selected work</h3>
                <div className="mt-3 columns-2 gap-3 sm:columns-3 md:columns-4">
                  {portfolio.gallery.map((image) => (
                    <figure
                      key={image.url}
                      className="mb-3 break-inside-avoid border-2 border-black bg-white p-1"
                    >
                      <img src={image.url} alt={image.alt} loading="lazy" className="w-full" />
                      {image.caption && (
                        <figcaption className="p-2 font-mono text-[10px]">
                          {image.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {!portfolio.audio_embeds.length && !portfolio.gallery.length && (
              <div className="border-2 border-dashed border-black bg-white p-8 text-center font-mono text-sm">
                This student vendor has not added portfolio samples yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
