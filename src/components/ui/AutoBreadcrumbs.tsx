import React from "react";
import { useLocation, Link } from "react-router-dom";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Home from "lucide-react/dist/esm/icons/home";

interface AutoBreadcrumbsProps {
  customLabels?: Record<string, string>;
}

// Basic UUID check (v4)
const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Generic ID check (e.g. Supabase integer IDs or long random strings)
const isId = (str: string) => {
  if (isUUID(str)) return true;
  if (/^\d+$/.test(str) && str.length > 3) return true; // Numeric ID
  if (str.length > 20 && !str.includes("-")) return true; // Random token
  return false;
};

export const AutoBreadcrumbs: React.FC<AutoBreadcrumbsProps> = ({ customLabels = {} }) => {
  const location = useLocation();
  const pathname = location.pathname;

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null; // Don't show breadcrumbs on home page
  }

  const formatSegment = (segment: string) => {
    if (customLabels[segment]) {
      return customLabels[segment];
    }
    if (isId(segment)) {
      return "Details";
    }
    // Capitalize and replace hyphens
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b-2 border-black bg-white dark:bg-black px-4 py-3 md:px-6 shadow-[2px_2px_0_0_#000] mb-4"
    >
      <ol className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold uppercase text-black dark:text-white">
        <li>
          <Link
            to="/"
            className="flex items-center hover:text-gray-500 transition-colors"
            aria-label="Home"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = "/" + segments.slice(0, index + 1).join("/");

          return (
            <React.Fragment key={href}>
              <li>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </li>
              <li>
                {isLast ? (
                  <span
                    className="text-black dark:text-white font-black break-all"
                    aria-current="page"
                  >
                    {formatSegment(segment)}
                  </span>
                ) : (
                  <Link
                    to={href}
                    className="text-gray-500 hover:text-black dark:hover:text-white underline transition-colors break-all"
                  >
                    {formatSegment(segment)}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
