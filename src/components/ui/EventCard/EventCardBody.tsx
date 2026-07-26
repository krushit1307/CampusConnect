import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEventCardContext } from "./EventCardContext";
import { EventCardProgressBar } from "./EventCardProgressBar";
import { EventCardDetails } from "./EventCardDetails";

export function EventCardBody() {
  const { event, club, isDescriptionExpanded, setIsDescriptionExpanded } = useEventCardContext();

  const shouldTruncate = !!event.description && event.description.length > 220;

  const displayedDescription =
    shouldTruncate && !isDescriptionExpanded
      ? `${event.description!.slice(0, 180)}...`
      : event.description;

  return (
    <>
      <p className="mt-3 font-mono text-xs font-bold uppercase text-black">Event</p>
      <Link to={`/events/${event.id}`} className="group">
        <h2 className="mt-1 text-2xl font-black group-hover:underline text-violet-900">
          {event.title}
        </h2>
      </Link>
      <p className="mt-1 font-mono text-sm font-bold text-blue-900">{club?.name}</p>

      {event.description ? (
        <div className="mt-4">
          <motion.div
            initial={false}
            animate={{ height: "auto" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-sm leading-6 text-gray-800 inline">{displayedDescription}</p>

            {shouldTruncate && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                className="ml-1 inline font-semibold text-violet-700 hover:text-violet-900 transition-colors"
              >
                {isDescriptionExpanded ? "Read less" : "Read more"}
              </button>
            )}
          </motion.div>
        </div>
      ) : null}

      <EventCardProgressBar />
      <EventCardDetails />
    </>
  );
}
