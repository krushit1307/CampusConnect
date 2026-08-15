// src/components/ClubAffiliationBadges.tsx
import React, { useState } from "react";
import { ClubAffiliation } from "@/types/clubAffiliation";
import { useClubAffiliations } from "@/hooks/useClubAffiliations";
import Award from "lucide-react/dist/esm/icons/award";
import Shield from "lucide-react/dist/esm/icons/shield";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";

interface ClubAffiliationBadgesProps {
  userId?: string | null;
  displayBadges?: boolean;
  affiliations?: ClubAffiliation[];
  maxDisplay?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function ClubAffiliationBadges({
  userId,
  displayBadges = true,
  affiliations: propAffiliations,
  maxDisplay = 2,
  size = "sm",
  className = "",
}: ClubAffiliationBadgesProps) {
  const { affiliations: fetchedAffiliations } = useClubAffiliations(
    !propAffiliations && userId ? userId : null
  );

  const [showMoreOpen, setShowMoreOpen] = useState(false);

  // If user disabled badge display on this post, do not render
  if (displayBadges === false) {
    return null;
  }

  const affiliations = propAffiliations || fetchedAffiliations;

  if (!affiliations || affiliations.length === 0) {
    return null;
  }

  const primaryBadges = affiliations.slice(0, maxDisplay);
  const remainingBadges = affiliations.slice(maxDisplay);

  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[9px] gap-1",
    sm: "px-2 py-0.5 text-xs gap-1.5",
    md: "px-2.5 py-1 text-sm gap-2",
  };

  const iconSizes = {
    xs: 10,
    sm: 12,
    md: 14,
  };

  return (
    <div className={`inline-flex items-center flex-wrap gap-1.5 ${className}`}>
      {primaryBadges.map((aff) => {
        const tooltipText = `${aff.role_name} of ${aff.club_name}`;

        return (
          <div
            key={aff.club_id}
            title={tooltipText}
            className={`group relative neu-border inline-flex items-center bg-[#FFD166] text-black font-mono font-bold uppercase cursor-default shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 ${sizeClasses[size]}`}
          >
            <Shield size={iconSizes[size]} className="shrink-0 text-black fill-black/20" />
            <span className="truncate max-w-[120px]">{aff.club_name}</span>

            {/* Custom Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block group-focus:block z-50 whitespace-nowrap neu-border bg-black text-white px-2.5 py-1 text-[11px] font-mono shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <span className="font-bold text-amber-300">{aff.role_name}</span> at {aff.club_name}
            </div>
          </div>
        );
      })}

      {/* Overflow "+N more" badge */}
      {remainingBadges.length > 0 && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowMoreOpen((prev) => !prev)}
            onBlur={() => setTimeout(() => setShowMoreOpen(false), 200)}
            title={`View ${remainingBadges.length} more affiliation(s)`}
            className={`neu-border inline-flex items-center bg-gray-200 text-black font-mono font-bold uppercase cursor-pointer shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] hover:bg-gray-300 transition-colors ${sizeClasses[size]}`}
          >
            <span>+{remainingBadges.length} more</span>
            <ChevronDown size={iconSizes[size]} className={`transition-transform ${showMoreOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Popover / Tooltip listing remaining executive affiliations */}
          {showMoreOpen && (
            <div className="absolute left-0 top-full mt-1.5 z-50 w-56 neu-border bg-white p-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 dark:text-cream">
              <p className="font-mono text-[10px] font-bold uppercase text-gray-500 mb-1.5 border-b pb-1">
                Additional Affiliations
              </p>
              <div className="space-y-1.5">
                {remainingBadges.map((aff) => (
                  <div key={aff.club_id} className="flex items-center gap-1.5 text-xs font-mono">
                    <Award size={12} className="text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold text-black dark:text-white">{aff.role_name}</span>
                      <span className="text-gray-500 block text-[10px]">{aff.club_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
