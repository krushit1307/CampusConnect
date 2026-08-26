import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import PenLine from "lucide-react/dist/esm/icons/pen-line";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

export interface DiscussionEmptyStateProps {
  /** Optional active search query */
  searchQuery?: string;
  /** Callback fired when the user clicks the "Start a discussion" button */
  onStartDiscussion?: () => void;
  /** Optional container class overrides */
  className?: string;
}

/**
 * Empty state component rendered when a club/discussion feed has no posts,
 * or when search criteria return no results.
 */
export function DiscussionEmptyState({
  searchQuery,
  onStartDiscussion,
  className = "",
}: DiscussionEmptyStateProps) {
  const isSearchActive = Boolean(searchQuery && searchQuery.trim().length > 0);

  return (
    <div
      className={`neu-border relative overflow-hidden bg-white px-6 py-12 text-center sm:px-10 sm:py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="absolute -left-6 -top-6 h-24 w-24 rotate-12 border-2 border-black bg-lime"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-8 -right-6 h-28 w-28 -rotate-12 border-2 border-black bg-peach"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-xl flex-col items-center">
        <div className="relative mb-6" aria-hidden="true">
          <div className="neu-border flex h-24 w-24 items-center justify-center bg-lime sm:h-28 sm:w-28">
            <MessageCircle className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={2.5} />
          </div>
          <div className="neu-border absolute -right-4 -top-4 flex h-10 w-10 items-center justify-center bg-peach">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
        </div>

        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em]">
          The conversation starts here
        </p>
        <h2 className="text-2xl font-bold sm:text-3xl">
          {isSearchActive
            ? "No posts match your search query."
            : "No posts yet. Be the first to start a discussion!"}
        </h2>
        <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-gray-700">
          {isSearchActive
            ? "Try searching for a different keyword or clear your search to view all club discussions."
            : "Share an announcement, ask a question, or post an update for your club community."}
        </p>

        {onStartDiscussion && (
          <button
            type="button"
            onClick={onStartDiscussion}
            className="neu-border mt-7 inline-flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black cursor-pointer"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Start a discussion
          </button>
        )}
      </div>
    </div>
  );
}
