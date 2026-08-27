import React from "react";
import { cn } from "@/lib/utils";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Info from "lucide-react/dist/esm/icons/info";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";

/* ── Date Tooltip ── */

export interface DateTooltipContentProps {
  /** Full formatted date string (e.g. "October 15, 2026 at 2:30 PM IST"). */
  fullDate: string;
  /** Relative time string (e.g. "in 3 days", "2 hours ago"). */
  relativeTime?: string;
  /** Optional timezone label. */
  timezone?: string;
  className?: string;
}

/**
 * Rich date tooltip content showing full date, relative time, and timezone.
 */
export const DateTooltipContent: React.FC<DateTooltipContentProps> = ({
  fullDate,
  relativeTime,
  timezone,
  className,
}) => (
  <div className={cn("space-y-1.5 min-w-[180px]", className)}>
    <div className="flex items-center gap-2">
      <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      <span className="text-xs font-semibold text-white">{fullDate}</span>
    </div>
    {relativeTime && (
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-[11px] text-slate-300">{relativeTime}</span>
      </div>
    )}
    {timezone && (
      <div className="text-[10px] text-slate-500 border-t border-slate-700/60 pt-1 mt-1">
        Timezone: {timezone}
      </div>
    )}
  </div>
);

/* ── Location Tooltip ── */

export interface LocationTooltipContentProps {
  /** Venue / address name. */
  venue: string;
  /** Full address line. */
  address?: string;
  /** Google Maps URL or other navigation link. */
  mapsUrl?: string;
  className?: string;
}

/**
 * Rich location tooltip with venue, address, and optional maps link.
 */
export const LocationTooltipContent: React.FC<LocationTooltipContentProps> = ({
  venue,
  address,
  mapsUrl,
  className,
}) => (
  <div className={cn("space-y-1.5 min-w-[180px]", className)}>
    <div className="flex items-center gap-2">
      <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
      <span className="text-xs font-semibold text-white">{venue}</span>
    </div>
    {address && <p className="text-[11px] text-slate-300 pl-5 leading-relaxed">{address}</p>}
    {mapsUrl && (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 pl-5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        <ExternalLink className="h-3 w-3" /> Open in Maps
      </a>
    )}
  </div>
);

/* ── Info Tooltip ── */

export interface InfoTooltipContentProps {
  /** Heading text. */
  title: string;
  /** Explanatory body text. */
  description: string;
  /** Optional variant affecting icon and accent color. */
  variant?: "info" | "warning";
  className?: string;
}

/**
 * Informational tooltip with heading, description, and variant styling.
 */
export const InfoTooltipContent: React.FC<InfoTooltipContentProps> = ({
  title,
  description,
  variant = "info",
  className,
}) => {
  const Icon = variant === "warning" ? AlertCircle : Info;
  const iconColor = variant === "warning" ? "text-amber-400" : "text-blue-400";

  return (
    <div className={cn("space-y-1.5 min-w-[180px] max-w-[280px]", className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-xs font-semibold text-white">{title}</span>
      </div>
      <p className="text-[11px] text-slate-300 pl-5 leading-relaxed">{description}</p>
    </div>
  );
};

/* ── Badge/Status Tooltip ── */

export interface StatusTooltipContentProps {
  /** Status label (e.g. "Approved", "Pending"). */
  status: string;
  /** Color for the status dot indicator. */
  statusColor?: string;
  /** Additional explanation text. */
  explanation?: string;
  className?: string;
}

/**
 * Status indicator tooltip with colored dot and explanation.
 */
export const StatusTooltipContent: React.FC<StatusTooltipContentProps> = ({
  status,
  statusColor = "bg-green-500",
  explanation,
  className,
}) => (
  <div className={cn("space-y-1 min-w-[140px]", className)}>
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full shrink-0", statusColor)} />
      <span className="text-xs font-semibold text-white">{status}</span>
    </div>
    {explanation && (
      <p className="text-[11px] text-slate-300 pl-4 leading-relaxed">{explanation}</p>
    )}
  </div>
);
