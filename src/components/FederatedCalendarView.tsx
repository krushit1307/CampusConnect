import React, { useEffect, useState, useCallback } from "react";
import {
  Globe,
  Building2,
  Calendar,
  MapPin,
  Clock,
  Filter,
  Loader2,
} from "lucide-react";
import {
  getUnifiedCalendar,
  type CalendarEvent,
  type UnifiedCalendarResult,
} from "../lib/federatedCalendar";
import { FederatedEventBadge } from "./FederatedEventBadge";
import { FederatedRSVPButton } from "./FederatedRSVPButton";

interface FederatedCalendarViewProps {
  startDate?: string;
  endDate?: string;
  className?: string;
}

/**
 * FederatedCalendarView
 *
 * A unified calendar view that merges local campus events with remote
 * federated events from partner campuses. Remote events display an
 * "External Campus" badge and offer cross-campus RSVP.
 */
export function FederatedCalendarView({
  startDate,
  endDate,
  className = "",
}: FederatedCalendarViewProps) {
  const [result, setResult] = useState<UnifiedCalendarResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRemote, setShowRemote] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    const data = await getUnifiedCalendar({
      startDate,
      endDate,
      includeRemote: showRemote,
      limit: 50,
    });
    setResult(data);
    setLoading(false);
  }, [startDate, endDate, showRemote]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  if (loading && !result) {
    return (
      <div className="flex items-center justify-center p-8" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-gray-500">
          Loading unified calendar...
        </span>
      </div>
    );
  }

  const events = result?.events || [];

  return (
    <div className={`federated-calendar-view ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Cross-Campus Events
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          {result && (
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {result.local_count} local
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                {result.remote_count} external
              </span>
            </div>
          )}

          {/* Toggle remote events */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRemote}
              onChange={(e) => setShowRemote(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Show external campuses
            </span>
          </label>
        </div>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm">
            {showRemote
              ? "No local or federated events in this time range."
              : "No local events. Try enabling external campus events."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <FederatedEventCard
              key={`${event.source}-${event.id}`}
              event={event}
              onSelect={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <FederatedEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

/* ── Event Card ─────────────────────────────────────────────────────── */

function FederatedEventCard({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: () => void;
}) {
  const isFederated = event.source === "federated";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md ${
        isFederated
          ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:border-indigo-300"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isFederated && (
              <FederatedEventBadge
                hostInstitution={event.host_institution || "Unknown Campus"}
              />
            )}
            {!isFederated && event.club_name && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {event.club_name}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {event.title}
          </h3>

          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {event.start_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(event.start_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {isFederated && (
          <Globe className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-1" />
        )}
      </div>
    </button>
  );
}

/* ── Event Detail Modal ─────────────────────────────────────────────── */

function FederatedEventModal({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const isFederated = event.source === "federated";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        {event.banner_url && (
          <img
            src={event.banner_url}
            alt={event.title}
            className="w-full h-48 object-cover rounded-t-2xl"
          />
        )}

        <div className="p-6">
          {/* Badge */}
          {isFederated && (
            <div className="mb-3">
              <FederatedEventBadge
                hostInstitution={event.host_institution || "Unknown Campus"}
              />
            </div>
          )}

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {event.title}
          </h2>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
            {event.start_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(event.start_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
            {event.club_name && (
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {event.club_name}
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {event.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isFederated && event.origin_domain && event.origin_event_id ? (
              <FederatedRSVPButton
                originDomain={event.origin_domain}
                originEventId={event.origin_event_id}
                hostInstitution={event.host_institution || "Partner Campus"}
              />
            ) : (
              <button className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors">
                RSVP
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
