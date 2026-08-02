import { LazyMotion } from "framer-motion";
import { DiscoveryCard } from "./DiscoveryCard";
import { useClubDiscovery, type DiscoveryClub } from "./useClubDiscovery";
import { loadDomMax } from "@/lib/motionFeatures";

interface DiscoveryCardStackProps {
  /** Current user id; used to exclude clubs they've already joined. */
  userId: string | null;
  /** Number of clubs to fetch per page. Defaults to 10 per issue #1903 spec. */
  pageSize?: number;
  /** Threshold in pixels for a swipe to count as a deliberate gesture. */
  swipeThreshold?: number;
  /** Called when the user swipes right past the threshold on a club. */
  onJoin?: (club: DiscoveryClub) => void;
  /** Called when the user swipes left past the threshold. */
  onSkip?: (club: DiscoveryClub) => void;
  /**
   * When the stack drops to this many remaining cards, fire a background
   * fetch for the next page. Defaults to 3 per issue #1903 spec.
   */
  prefetchThreshold?: number;
}

/**
 * DiscoveryCardStack — a Tinder-style swipe deck for club discovery
 * (issue #1903).
 *
 * Renders up to {@link pageSize} clubs as absolutely positioned cards
 * stacked with z-index ordering. The top card is draggable on the X axis
 * via framer-motion; useTransform maps the drag x to a slight rotation
 * so the card tilts as the user drags. Past the threshold the card is
 * popped from the deck; right-swipe fires the join mutation, left-swipe
 * just dismisses.
 *
 * Edge case (issue #1903): when the deck drops to {@link prefetchThreshold}
 * remaining cards, a background fetch is triggered for the next page.
 * When the deck empties entirely, an empty state is shown.
 */
export function DiscoveryCardStack({
  userId,
  pageSize,
  swipeThreshold = 150,
  onJoin,
  onSkip,
  prefetchThreshold,
}: DiscoveryCardStackProps) {
  const { cards, isLoading, isEmpty, refresh, dismiss } = useClubDiscovery({
    userId,
    pageSize,
    prefetchThreshold,
    onJoin,
    onSkip,
  });

  if (!userId) {
    return (
      <EmptyState
        title="Sign in to discover clubs"
        message="You'll need an account before you can swipe through the club directory."
      />
    );
  }

  if (isLoading && cards.length === 0) {
    return <EmptyState title="Finding clubs…" message="Just a moment." />;
  }

  if (isEmpty) {
    return (
      <EmptyState
        title="You're all caught up!"
        message="No more clubs to show right now. Check back later or refresh for a fresh batch."
        actionLabel="Refresh"
        onAction={refresh}
      />
    );
  }

  // Render the stack top-down: index 0 (the top card) gets the highest
  // z-index + drag handlers; subsequent cards sit underneath as static
  // peeks.
  return (
    <LazyMotion features={loadDomMax} strict={import.meta.env.DEV}>
      <div
        data-testid="discovery-card-stack"
        role="region"
        aria-label="Club discovery deck"
        className="relative mx-auto h-[480px] w-full max-w-sm"
      >
        {cards
          .slice()
          .reverse()
          .map((club, reversedIndex) => {
            const stackIndex = cards.length - 1 - reversedIndex;
            return (
              <DiscoveryCard
                key={club.id}
                club={club}
                stackIndex={stackIndex}
                totalCount={cards.length}
                isTop={stackIndex === 0}
                swipeThreshold={swipeThreshold}
                onDismiss={(direction) => dismiss(club.id, direction)}
              />
            );
          })}
      </div>
    </LazyMotion>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      data-testid="discovery-empty-state"
      role="status"
      className="mx-auto flex h-[480px] w-full max-w-sm flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-black bg-white p-8 text-center"
    >
      <h3 className="font-display text-2xl font-bold text-brand-blue-dark">{title}</h3>
      <p className="font-mono text-sm text-gray-700">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-md border-2 border-black bg-brand-peach-light px-4 py-2 font-mono text-xs font-bold uppercase text-brand-blue-dark transition hover:bg-white"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
