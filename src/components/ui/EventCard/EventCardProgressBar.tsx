import { useEventCardContext } from "./EventCardContext";

const ASSUMED_LEAD_TIME_DAYS = 30;

interface EventProgress {
  percent: number;
  isPast: boolean;
  isEstimated: boolean;
}

function getEventProgress(createdAt: string | null | undefined, eventDate: string): EventProgress {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();

  if (now > eventTime) {
    return { percent: 100, isPast: true, isEstimated: false };
  }

  let isEstimated = false;
  let startTime: number;

  if (createdAt) {
    startTime = new Date(createdAt).getTime();
  } else {
    startTime = eventTime - ASSUMED_LEAD_TIME_DAYS * 24 * 60 * 60 * 1000;
    isEstimated = true;
  }

  const totalWindow = eventTime - startTime;
  if (totalWindow <= 0) {
    return { percent: 100, isPast: false, isEstimated };
  }

  const elapsed = now - startTime;
  const percent = Math.min(100, Math.max(0, (elapsed / totalWindow) * 100));

  return { percent, isPast: false, isEstimated };
}

export function EventCardProgressBar() {
  const { event } = useEventCardContext();
  const createdAt = event.created_at;
  const eventDate = event.event_date;

  if (!eventDate) return null;

  const { percent, isPast, isEstimated } = getEventProgress(createdAt, eventDate);

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold uppercase text-black">
        <span>Time to event</span>
        <span>{isPast ? "Ended" : `${Math.round(percent)}%`}</span>
      </div>
      <div className="h-4 w-full neu-border overflow-hidden bg-white p-0.5">
        {isPast ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <span className="font-mono text-[9px] font-bold uppercase text-gray-500">
              Event has passed
            </span>
          </div>
        ) : (
          <div
            className="h-full border-r-2 border-black bg-lime transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {isEstimated && !isPast && (
        <p className="mt-1 font-mono text-[9px] text-gray-500">
          Estimated — creation date unavailable
        </p>
      )}
    </div>
  );
}
