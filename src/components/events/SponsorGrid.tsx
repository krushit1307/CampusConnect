// =============================================================================
// Component: SponsorGrid
// Issue: #2808 - Implement 'Sponsorship' Tiers and Dynamic Banners for Events
// Description: Dynamically renders a responsive grid of event sponsors.
// Sizes logos based on their tier level(Platinum = 50 %, Gold = 33 %, etc.).
// Applies grayscale hover effects and ensures aspect ratios are maintained.
// =============================================================================

import React from "react";
import { Sponsor, SponsorTier, useEventSponsors } from "../../hooks/useEventSponsors";
import { SponsorLogoFallback } from "./SponsorLogoFallback";

import { useHoverTelemetry } from "../../hooks/useHoverTelemetry";
import { useAuthStore } from "../../store/useAuthStore";
import { createClient } from "../../lib/supabase/client";

interface SponsorGridProps {
  eventId: string;
  isEditMode?: boolean;
}

export const SponsorGrid: React.FC<SponsorGridProps> = ({ eventId, isEditMode = false }) => {
  const user = useAuthStore((state) => state.user);
  const { sponsors, isLoading, deleteSponsor, updateSponsorTier } = useEventSponsors(eventId);

  // Group sponsors by tier for structured rendering
  const groupedSponsors = {
    platinum: sponsors.filter((s) => s.tier_level === "platinum"),
    gold: sponsors.filter((s) => s.tier_level === "gold"),
    silver: sponsors.filter((s) => s.tier_level === "silver"),
    bronze: sponsors.filter((s) => s.tier_level === "bronze"),
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8 py-8">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mx-auto"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (sponsors.length === 0 && !isEditMode) {
    return null; // Don't show section if no sponsors and not in edit mode
  }

  const getTierConfig = (tier: SponsorTier) => {
    switch (tier) {
      case "platinum":
        return {
          title: "Platinum Sponsors",
          gridCols: "grid-cols-1 md:grid-cols-2",
          height: "h-40 md:h-48",
          badgeColor:
            "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600",
          accentColor: "text-slate-600 dark:text-slate-400",
        };
      case "gold":
        return {
          title: "Gold Sponsors",
          gridCols: "grid-cols-2 md:grid-cols-3",
          height: "h-32 md:h-40",
          badgeColor:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
          accentColor: "text-yellow-600 dark:text-yellow-400",
        };
      case "silver":
        return {
          title: "Silver Sponsors",
          gridCols: "grid-cols-3 md:grid-cols-4",
          height: "h-24 md:h-32",
          badgeColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
          accentColor: "text-gray-500 dark:text-gray-400",
        };
      case "bronze":
        return {
          title: "Bronze Sponsors",
          gridCols: "grid-cols-4 md:grid-cols-6",
          height: "h-20 md:h-24",
          badgeColor:
            "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
          accentColor: "text-orange-600 dark:text-orange-400",
        };
    }
  };

  const renderTierSection = (tier: SponsorTier, tierSponsors: Sponsor[]) => {
    if (tierSponsors.length === 0) return null;

    const config = getTierConfig(tier);

    return (
      <div className="mb-12 last:mb-0">
        <div className="flex items-center gap-3 mb-6">
          <h3 className={`text-xl font-bold ${config.accentColor}`}>{config.title}</h3>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        </div>

        <div className={`grid ${config.gridCols} gap-4`}>
          {tierSponsors.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              eventId={eventId}
              heightClass={config.height}
              isEditMode={isEditMode}
              userId={user?.id}
              onDelete={() => deleteSponsor(sponsor.id)}
              onTierChange={(newTier) => updateSponsorTier(sponsor.id, newTier)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Our Sponsors</h2>
        <p className="text-gray-600 dark:text-gray-400">
          This event is made possible by the generous support of our partners.
        </p>
      </div>

      {renderTierSection("platinum", groupedSponsors.platinum)}
      {renderTierSection("gold", groupedSponsors.gold)}
      {renderTierSection("silver", groupedSponsors.silver)}
      {renderTierSection("bronze", groupedSponsors.bronze)}
    </div>
  );
};

/**
 * Individual Sponsor Card Component with Viewability Tracker
 */
interface SponsorCardProps {
  userId?: string | null;
  sponsor: Sponsor;
  eventId: string;
  heightClass: string;
  isEditMode: boolean;
  onDelete: () => void;
  onTierChange: (tier: SponsorTier) => void;
}

const SponsorCard: React.FC<SponsorCardProps> = ({
  userId,
  sponsor,
  eventId,
  heightClass,
  isEditMode,
  onDelete,
  onTierChange,
}) => {
  const { onMouseEnter, onMouseLeave, onClick } = useHoverTelemetry(sponsor.id, userId);
  const [hasTrackedImpression, setHasTrackedImpression] = React.useState(false);
  const cardRef = React.useRef<HTMLElement | null>(null);

  const CardWrapper = sponsor.website_url && !isEditMode ? "a" : "div";
  const wrapperProps =
    sponsor.website_url && !isEditMode
      ? { href: sponsor.website_url, target: "_blank", rel: "noopener noreferrer" }
      : {};

  React.useEffect(() => {
    if (isEditMode || hasTrackedImpression || !cardRef.current) return;

    let timerId: NodeJS.Timeout | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio === 1.0) {
            // 100% of pixels visible in user's viewport, start 2000ms timer
            if (!timerId) {
              timerId = setTimeout(async () => {
                try {
                  const supabase = createClient();
                  const { data, error } = await supabase.rpc("record_sponsor_logo_impression", {
                    p_sponsor_id: sponsor.id,
                    p_event_id: eventId,
                    p_time_in_view_ms: 2000,
                  });
                  if (error) {
                    console.error("Failed to record sponsor logo impression:", error);
                  } else {
                    console.log("Verified viewable impression recorded successfully:", data);
                    setHasTrackedImpression(true);
                  }
                } catch (err) {
                  console.error("Error verifying viewable impression:", err);
                }
              }, 2000);
            }
          } else {
            // No longer 100% visible, cancel timer
            if (timerId) {
              clearTimeout(timerId);
              timerId = null;
            }
          }
        });
      },
      {
        threshold: 1.0, // Strict 100% visibility requirement
      },
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [sponsor.id, eventId, isEditMode, hasTrackedImpression]);

  return (
    <CardWrapper
      {...wrapperProps}
      ref={cardRef as any}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        onClick();
        if (wrapperProps.onClick) wrapperProps.onClick(e as any);
      }}
      className={`
        group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
        rounded-xl p-6 flex items-center justify-center transition-all duration-300
        ${!isEditMode && sponsor.website_url ? "hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-1 cursor-pointer" : ""}
      `}
    >
      {/* Logo Container with fixed aspect ratio and object-contain */}
      <div className={`w-full ${heightClass} flex items-center justify-center overflow-hidden`}>
        <SponsorLogoFallback
          name={sponsor.name}
          src={sponsor.logo_url}
          alt={`${sponsor.name} logo`}
          className="h-full w-full"
          imageClassName="max-h-full max-w-full object-contain transition-all duration-300 group-hover:grayscale-0 grayscale"
          style={{ filter: "grayscale(20%)" }}
        />
      </div>

      {/* Tooltip with Sponsor Name */}
      <div className="absolute bottom-2 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-gray-900/90 px-2 py-1 rounded shadow-sm">
          {sponsor.name}
        </span>
      </div>

      {/* Edit Mode Controls */}
      {isEditMode && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <select
            value={sponsor.tier_level}
            onChange={(e) => onTierChange(e.target.value as SponsorTier)}
            className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 text-gray-700 dark:text-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
          </select>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      )}
    </CardWrapper>
  );
};
