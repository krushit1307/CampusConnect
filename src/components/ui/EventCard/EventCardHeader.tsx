import { formatDate } from "@/lib/utils";
import { BookmarkButton } from "@/components/events/BookmarkButton";
import Check from "lucide-react/dist/esm/icons/check";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import { useEventCardContext } from "./EventCardContext";

export function EventCardHeader() {
  const { event, countdown, isSaved, isBookmarkPending, handleBookmarkClick, handleShare, copied } =
    useEventCardContext();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col">
        <p className="font-mono text-xs font-bold uppercase tracking-wider pr-10 text-red-900">
          {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
        </p>

        {event.event_date && (
          <span
            className={`mt-2 inline-flex min-h-[24px] items-center rounded-full px-2 py-1 text-[11px] font-bold ${
              countdown === "Ended" ? "bg-gray-100 text-gray-600" : "bg-peach text-orange-700"
            }`}
          >
            {countdown}
          </span>
        )}
      </div>

      <div className="flex gap-2 relative z-10">
        <BookmarkButton
          isSaved={isSaved}
          isPending={isBookmarkPending}
          onClick={handleBookmarkClick}
        />
        <button
          type="button"
          onClick={handleShare}
          aria-label="Copy event link"
          className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white text-black"
        >
          {copied ? (
            <Check aria-hidden="true" size={14} strokeWidth={3} />
          ) : (
            <Share2 aria-hidden="true" size={14} strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
}
