import React, { useEffect, useState } from "react";
import { SponsorAbTest, VariantType, SponsorLogoVariant } from "../../types/sponsorAbTesting";
import { sponsorAbTestingService } from "../../services/sponsorAbTestingService";

interface SponsorAbBannerProps {
  test: SponsorAbTest;
  userId?: string;
  className?: string;
  onVariantServed?: (variant: VariantType) => void;
  onClickThrough?: (variant: VariantType, targetUrl: string) => void;
}

export const SponsorAbBanner: React.FC<SponsorAbBannerProps> = ({
  test,
  userId,
  className = "",
  onVariantServed,
  onClickThrough,
}) => {
  const [activeVariantKey, setActiveVariantKey] = useState<VariantType>("LOGO_A");
  const [hasReportedImpression, setHasReportedImpression] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function assignAndTrack() {
      // Determine variant (100% winner if concluded, otherwise 50/50)
      const assigned = await sponsorAbTestingService.getVariantForUser(test.id, userId);
      if (isMounted) {
        setActiveVariantKey(assigned);
        onVariantServed?.(assigned);

        if (!hasReportedImpression) {
          await sponsorAbTestingService.trackEvent({
            testId: test.id,
            variantKey: assigned,
            eventType: "impression",
            userId,
          });
          setHasReportedImpression(true);
        }
      }
    }

    assignAndTrack();

    return () => {
      isMounted = false;
    };
  }, [test.id, userId, test.winningVariant]);

  const activeVariant: SponsorLogoVariant =
    activeVariantKey === "LOGO_A" ? test.variantA : test.variantB;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await sponsorAbTestingService.trackEvent({
      testId: test.id,
      variantKey: activeVariantKey,
      eventType: "click",
      userId,
    });

    if (onClickThrough) {
      onClickThrough(activeVariantKey, activeVariant.targetUrl);
    } else {
      window.open(activeVariant.targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md ${className}`}
      data-testid="sponsor-ab-banner"
      data-variant={activeVariantKey}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sponsored by
          </div>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {test.sponsorName}
          </span>
          {test.winningVariant && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              ⚡ Winning Creative
            </span>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/60">
          Variant {activeVariantKey === "LOGO_A" ? "A" : "B"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <a
          href={activeVariant.targetUrl}
          onClick={handleClick}
          className="group flex items-center space-x-4 focus:outline-none"
          title={`Visit ${test.sponsorName}`}
        >
          <div
            className="flex h-14 w-32 items-center justify-center rounded-lg border border-border/50 p-2 transition-transform group-hover:scale-105"
            style={{ backgroundColor: activeVariant.backgroundColor || "#ffffff" }}
          >
            <img
              src={activeVariant.logoUrl}
              alt={activeVariant.altText}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div>
            {activeVariant.tagline && (
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {activeVariant.tagline}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Click to explore partnership perks & offers →
            </p>
          </div>
        </a>
      </div>
    </div>
  );
};
