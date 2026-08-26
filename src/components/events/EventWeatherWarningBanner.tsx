import React, { useState } from "react";
import { CloudLightning, AlertTriangle, ArrowRight, XCircle, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getEventWeatherAlerts, type EventWeatherAlert } from "@/services/eventWeatherAlertService";
import { CancelEventDangerModal } from "@/components/events/CancelEventDangerModal";

export interface EventWeatherWarningBannerProps {
  eventId: string;
  eventTitle: string;
  isOutdoor?: boolean;
}

export const EventWeatherWarningBanner: React.FC<EventWeatherWarningBannerProps> = ({
  eventId,
  eventTitle,
  isOutdoor = false,
}) => {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const { data: alerts } = useQuery<EventWeatherAlert[]>({
    queryKey: ["event_weather_alerts", eventId],
    queryFn: () => getEventWeatherAlerts(eventId),
    enabled: !!eventId,
  });

  const latestAlert = alerts && alerts.length > 0 ? alerts[0] : null;

  if (!latestAlert && !isOutdoor) {
    return null;
  }

  // If there's an active severe weather alert
  if (latestAlert) {
    const probability = Math.round(Number(latestAlert.precipitation_probability || 0) * 100);

    return (
      <>
        <div className="mb-6 border-2 border-red-600 bg-red-100 p-4 text-red-950 shadow-[4px_4px_0_0_#991b1b]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-red-800 bg-red-600 text-white">
                <CloudLightning className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-800 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-white tracking-wider">
                    CRITICAL WEATHER ALERT
                  </span>
                  <span className="font-mono text-xs font-bold text-red-900">
                    Forecast: {new Date(latestAlert.forecast_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-base font-black uppercase tracking-tight text-red-950">
                  Severe impending weather detected ({latestAlert.condition.toUpperCase()})
                </h3>
                <p className="font-mono text-xs text-red-900/90 mt-0.5">
                  Precipitation probability: <strong>{probability}%</strong>. Attendees risk severe weather exposure at this outdoor event.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 border-2 border-black bg-red-600 px-3.5 py-2 font-mono text-xs font-black uppercase text-white shadow-[2px_2px_0_0_#000] hover:bg-red-700 active:translate-x-0.5 active:translate-y-0.5"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel Event & Notify
              </button>

              {latestAlert.indoor_backup_url && (
                <a
                  href={latestAlert.indoor_backup_url}
                  className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3.5 py-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0_0_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Change Venue
                </a>
              )}
            </div>
          </div>
        </div>

        <CancelEventDangerModal
          eventId={eventId}
          eventTitle={eventTitle}
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
        />
      </>
    );
  }

  return null;
};
