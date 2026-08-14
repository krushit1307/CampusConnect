import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useBreadcrumbs, BreadcrumbItem } from "./BreadcrumbsContext";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";

const STATIC_SEGMENTS = new Set([
  "clubs",
  "events",
  "dashboard",
  "rsvps",
  "bookmarks",
  "calendar",
  "settings",
  "messages",
  "admin",
  "reports",
  "users",
  "restore",
  "challenge",
  "leaderboard",
  "feed",
  "directory",
]);

const SEGMENT_LABEL_MAP: Record<string, string> = {
  clubs: "Clubs",
  events: "Events",
  dashboard: "Dashboard",
  rsvps: "My RSVPs",
  bookmarks: "My Bookmarks",
  calendar: "My Calendar",
  settings: "Settings",
  messages: "Messages",
  admin: "Admin",
  reports: "Reports",
  users: "Users",
  restore: "Restore",
  challenge: "Challenge Arena",
  leaderboard: "Leaderboard",
  feed: "Feed",
  directory: "Directory",
};

export function Breadcrumbs() {
  const location = useLocation();
  const { labels, customTrail } = useBreadcrumbs();

  const currentPath = location.pathname;
  const pathSegments = currentPath.split("/").filter(Boolean);

  // Determine active language prefix if present (e.g. /en or /es)
  let lang = "en";
  if (pathSegments[0] && pathSegments[0].length === 2) {
    lang = pathSegments[0];
    pathSegments.shift();
  }

  // If we are on the home page, do not render breadcrumbs
  if (pathSegments.length === 0 && !customTrail) {
    return null;
  }

  let trail: BreadcrumbItem[] = [];

  if (customTrail) {
    trail = customTrail;
  } else {
    // Build default trail by segment parsing
    trail.push({ label: "Home", path: `/${lang}` });

    let accumulatedPath = `/${lang}`;
    pathSegments.forEach((segment) => {
      accumulatedPath += `/${segment}`;

      const isStatic = STATIC_SEGMENTS.has(segment);
      const label: React.ReactNode = SEGMENT_LABEL_MAP[segment] || labels[segment];

      if (!label) {
        if (isStatic) {
          // Capitalize static segment if not mapped
          trail.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1),
            path: accumulatedPath,
          });
        } else {
          // Dynamic segment: render a skeleton loader until resolved
          trail.push({
            label: (
              <span className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700 inline-block align-middle" />
            ),
            path: accumulatedPath,
          });
        }
      } else {
        trail.push({
          label,
          path: accumulatedPath,
        });
      }
    });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b-2 border-black bg-white dark:bg-black px-4 py-3 md:px-6 shadow-[2px_2px_0_0_#000]"
    >
      <ol className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold uppercase text-black dark:text-white">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
              )}
              {isLast || !item.path ? (
                <span className="text-black dark:text-white font-black break-all">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="text-gray-500 hover:text-black dark:hover:text-white underline transition-colors break-all"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
