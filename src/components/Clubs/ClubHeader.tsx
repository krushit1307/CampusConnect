import { useLayoutEffect, useState, type ReactNode } from "react";
import { useScroll } from "@/hooks/useScroll";

// How far (px) the user needs to scroll before the header collapses into
// its compact, "stuck" state.
const DEFAULT_THRESHOLD = 200;

// Fallback offset for browsers/first paint before we've measured the real
// site navbar height. Matches the navbar's typical rendered height
// (px-*, py-3 + logo line-height) so there's no visible jump once measured.
const NAVBAR_HEIGHT_FALLBACK = 64;

interface ClubHeaderProps {
  clubName: string;
  /** Short initials/monogram shown as the club's logo (no logo_url field exists yet). */
  logoInitials: string;
  /** The large banner/hero visual. Fades out once the header collapses. */
  banner?: ReactNode;
  /** Small label rendered above the club name (e.g. an "Club" eyebrow). Hidden when compact. */
  eyebrow?: ReactNode;
  /** Secondary links (Tasks / Meeting Notes / Manage). Hidden when compact to save space. */
  secondaryActions?: ReactNode;
  /**
   * Primary action (the Join/Leave button). Rendered as a function so the
   * caller can size it down once the header is compact.
   */
  actions: (isCompact: boolean) => ReactNode;
  /** px of scrollY after which the header collapses. @default 200 */
  threshold?: number;
}

/**
 * Sticky, shrinking header for a club's profile page.
 *
 * Stays pinned under the site navbar as the user scrolls a long club feed,
 * so the club name and Join button remain reachable without scrolling back
 * to the top. Past `threshold` px of scroll it collapses: the banner fades
 * out, the logo shrinks, and the name/actions slide into a compact
 * horizontal, glassmorphism bar.
 */
export function ClubHeader({
  clubName,
  logoInitials,
  banner,
  eyebrow,
  secondaryActions,
  actions,
  threshold = DEFAULT_THRESHOLD,
}: ClubHeaderProps) {
  const scrollY = useScroll();
  const isCompact = scrollY > threshold;

  // Measure the real navbar height so this header sticks directly beneath
  // it instead of overlapping (the site navbar is itself `sticky top-0`).
  const [stickyOffset, setStickyOffset] = useState(NAVBAR_HEIGHT_FALLBACK);

  useLayoutEffect(() => {
    const measure = () => {
      const navbar = document.querySelector("header.sticky");
      if (navbar) setStickyOffset(navbar.getBoundingClientRect().height);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      className={`sticky z-30 border-b-2 border-black transition-colors duration-300 ease-out ${
        isCompact
          ? "backdrop-blur-md bg-white/80 dark:bg-black/80"
          : "bg-transparent border-transparent"
      }`}
      // iOS Safari can report a shrinking/growing viewport as its URL bar
      // collapses on scroll, which makes `top: 0` sticky elements jitter.
      // Pinning to a fixed, measured offset (rather than recalculating on
      // every scroll frame) keeps the header stable through that resize.
      style={{ top: stickyOffset }}
    >
      {banner && (
        <div
          aria-hidden={isCompact}
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            isCompact ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
          }`}
        >
          {banner}
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {eyebrow && (
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
              isCompact ? "max-h-0 opacity-0" : "max-h-8 opacity-100 pt-4"
            }`}
          >
            {eyebrow}
          </div>
        )}

        <div
          className={`flex gap-4 transition-all duration-300 ease-out ${
            isCompact ? "flex-row items-center justify-between py-2" : "flex-col items-start py-6"
          }`}
        >
          <div
            className={`flex min-w-0 items-center transition-all duration-300 ease-out ${isCompact ? "gap-3" : "gap-4"}`}
          >
            <div
              aria-hidden="true"
              className={`neu-border flex shrink-0 items-center justify-center bg-lime font-display font-bold text-black transition-all duration-300 ease-out ${
                isCompact ? "h-10 w-10 text-xs" : "h-24 w-24 text-2xl md:h-32 md:w-32 md:text-4xl"
              }`}
            >
              {logoInitials}
            </div>
            <h1
              className={`min-w-0 truncate font-bold text-brand-blue-dark transition-all duration-300 ease-out ${
                isCompact ? "text-lg md:text-xl" : "text-4xl md:text-7xl"
              }`}
            >
              {clubName}
            </h1>
          </div>

          <div className={`flex shrink-0 flex-wrap items-center gap-2 ${isCompact ? "" : "mt-1"}`}>
            {actions(isCompact)}
          </div>
        </div>

        {secondaryActions && (
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
              isCompact ? "max-h-0 opacity-0" : "max-h-20 opacity-100 pb-4"
            }`}
          >
            <div className="flex flex-wrap gap-2">{secondaryActions}</div>
          </div>
        )}
      </div>
    </div>
  );
}
