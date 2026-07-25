import { Link } from "react-router-dom";
import EmptyBookmark from "@/assets/empty-bookmarks.svg";

export default function EmptyBookmarks() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <img src={EmptyBookmark} alt="No bookmarks" className="mb-6 w-48 md:w-64" />

      <h2 className="text-2xl font-black">No Bookmarked Events</h2>

      <p className="mt-3 max-w-md text-sm leading-6 text-gray-700 dark:text-gray-300">
        You haven't bookmarked any events yet. Explore upcoming events and save your favourites.
      </p>

      <Link
        to="/events"
        className="neu-border neu-press mt-6 inline-flex bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cream dark:bg-white dark:text-black"
      >
        Browse Events
      </Link>
    </div>
  );
}
