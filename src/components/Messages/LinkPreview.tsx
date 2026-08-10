import { ExternalLink, Globe } from "lucide-react";
import { useLinkPreview } from "@/hooks/useLinkPreview";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LinkPreviewProps {
  /** The URL to generate a preview card for */
  url: string;
  /** Whether this preview is in the sender's (lime) bubble or receiver's (white) bubble */
  isMe?: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function LinkPreviewSkeleton({ isMe }: { isMe: boolean }) {
  const base = isMe
    ? "bg-lime/70 border-black/20"
    : "bg-slate-100 dark:bg-zinc-700 border-black/10 dark:border-white/10";
  return (
    <div
      className={`mt-2 border-2 overflow-hidden animate-pulse ${base}`}
      aria-label="Loading link preview"
      aria-busy="true"
    >
      <div className="h-28 bg-black/10 dark:bg-white/10" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-black/15 dark:bg-white/15" />
        <div className="h-2.5 w-full rounded bg-black/10 dark:bg-white/10" />
        <div className="h-2.5 w-5/6 rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders a rich OpenGraph preview card for a URL beneath a chat message.
 *
 * - Fetches OG data via the `link-preview` Edge Function (cached in session).
 * - Shows a skeleton while loading.
 * - Silently renders nothing if the fetch fails (graceful degradation).
 * - Clicking the card opens the link in a new tab.
 */
export function LinkPreview({ url, isMe = false }: LinkPreviewProps) {
  const { data, loading } = useLinkPreview(url);

  if (loading) return <LinkPreviewSkeleton isMe={isMe} />;

  // Graceful degradation — render nothing if no data
  if (!data || (!data.title && !data.description && !data.image)) return null;

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  const cardBase = isMe
    ? "border-black/25 bg-lime/80 text-black hover:bg-lime/90"
    : "border-black dark:border-cream/30 bg-white dark:bg-zinc-800 text-black dark:text-cream hover:bg-slate-50 dark:hover:bg-zinc-700";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group mt-2 block overflow-hidden border-2 transition-all duration-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] ${cardBase}`}
      aria-label={`Link preview: ${data.title ?? url}`}
    >
      {/* OG image */}
      {data.image && (
        <div className="relative overflow-hidden border-b-2 border-inherit">
          <img
            src={data.image}
            alt={data.title ?? "Link preview image"}
            className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={(e) => {
              // Hide broken image container
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Text content */}
      <div className="p-3">
        {/* Site origin row */}
        <div className="mb-1.5 flex items-center gap-1.5">
          {data.favicon ? (
            <img
              src={data.favicon}
              alt=""
              className="h-3.5 w-3.5 object-contain"
              aria-hidden="true"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Globe size={12} aria-hidden="true" className="opacity-50" />
          )}
          <span className="font-mono text-[10px] uppercase opacity-60 tracking-wider truncate">
            {hostname}
          </span>
          <ExternalLink
            size={10}
            aria-hidden="true"
            className="ml-auto shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
          />
        </div>

        {/* Title */}
        {data.title && (
          <p className="line-clamp-2 font-display text-xs font-bold leading-snug">{data.title}</p>
        )}

        {/* Description */}
        {data.description && (
          <p className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed opacity-70">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
