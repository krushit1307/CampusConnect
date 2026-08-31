import React, { useMemo, useState } from "react";
import { BadgeCheck, Search, ShieldQuestion, Star } from "lucide-react";
import {
  MwbeCategory,
  VendorSearchCandidate,
  describeCategory,
  rankVendorSearchResults,
} from "@/lib/supplierDiversity";

/**
 * Organizer vendor search with MWBE boosting (#5291).
 *
 * Certified vendors sort above uncertified ones so equitable spending is the path
 * of least resistance. Boosting is a reordering, never a filter: the mandate is a
 * spending target, not a procurement ban, so an uncertified vendor stays visible
 * and the organizer can still choose it.
 */

export interface MwbeVendorSearchProps {
  vendors: VendorSearchCandidate[];
  onSelectVendor?: (vendor: VendorSearchCandidate) => void;
}

const CATEGORY_BADGE_CLASS: Record<MwbeCategory, string> = {
  MINORITY_WOMEN_OWNED: "bg-violet-100 text-violet-800 border-violet-300",
  MINORITY_OWNED: "bg-sky-100 text-sky-800 border-sky-300",
  WOMEN_OWNED: "bg-rose-100 text-rose-800 border-rose-300",
  DISADVANTAGED: "bg-amber-100 text-amber-800 border-amber-300",
};

export const MwbeVendorSearch: React.FC<MwbeVendorSearchProps> = ({ vendors, onSelectVendor }) => {
  const [query, setQuery] = useState("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = vendors.filter((vendor) => {
      if (certifiedOnly && !vendor.mwbeCertified) return false;
      if (!needle) return true;
      return vendor.legalName.toLowerCase().includes(needle);
    });
    return rankVendorSearchResults(filtered);
  }, [vendors, query, certifiedOnly]);

  const certifiedCount = results.filter((vendor) => vendor.mwbeCertified).length;

  return (
    <div className="space-y-4" data-testid="mwbe-vendor-search">
      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Search vendors</span>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search vendors"
            placeholder="Search vendors by name"
            className="neu-border w-full py-2 pl-9 pr-3 font-mono text-sm"
          />
        </label>

        <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-600">
          <input
            type="checkbox"
            checked={certifiedOnly}
            onChange={(event) => setCertifiedOnly(event.target.checked)}
            aria-label="Show only MWBE certified vendors"
          />
          MWBE certified only
        </label>

        <p className="font-mono text-xs text-slate-500" data-testid="mwbe-result-summary">
          {results.length} vendors · {certifiedCount} MWBE certified, listed first
        </p>
      </div>

      <ul className="space-y-2">
        {results.map((vendor) => (
          <li key={vendor.vendorId}>
            <button
              type="button"
              onClick={() => onSelectVendor?.(vendor)}
              data-testid={`vendor-row-${vendor.vendorId}`}
              className="neu-border flex w-full items-center justify-between gap-3 bg-white p-3 text-left shadow-[2px_2px_0_0_#000]"
            >
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-bold">
                  {vendor.legalName}
                </span>
                <span className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  {typeof vendor.averageRating === "number" && (
                    <>
                      <Star className="h-3 w-3" aria-hidden="true" />
                      {vendor.averageRating.toFixed(1)}
                    </>
                  )}
                  <span>relevance {vendor.relevanceScore.toFixed(2)}</span>
                </span>
              </span>

              {vendor.mwbeCertified ? (
                <span
                  data-testid={`mwbe-badge-${vendor.vendorId}`}
                  className={`flex shrink-0 items-center gap-1 border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    CATEGORY_BADGE_CLASS[vendor.category ?? "MINORITY_OWNED"]
                  }`}
                >
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  MWBE Certified · {describeCategory(vendor.category)}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 border border-slate-200 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <ShieldQuestion className="h-3 w-3" aria-hidden="true" />
                  Not certified
                </span>
              )}
            </button>
          </li>
        ))}

        {results.length === 0 && (
          <li className="font-mono text-xs text-slate-500">No vendors match this search.</li>
        )}
      </ul>
    </div>
  );
};

export default MwbeVendorSearch;
