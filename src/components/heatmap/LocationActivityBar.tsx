/**
 * LocationActivityBar — Horizontal bar chart showing event + RSVP activity per location.
 */

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { LocationActivity, getFillRateColor } from "@/utils/activityHeatmap";

interface LocationActivityBarProps {
  locations: LocationActivity[];
  maxEvents: number;
}

export function LocationActivityBar({ locations, maxEvents }: LocationActivityBarProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <MapPin className="w-4 h-4 text-teal-400" />
        <h3 className="text-white font-semibold text-sm">Location Activity</h3>
        <span className="text-gray-500 text-[10px] ml-auto">
          {locations.length} venue{locations.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2.5">
        {locations.slice(0, 10).map((loc, i) => {
          const barWidth = maxEvents > 0 ? (loc.totalEvents / maxEvents) * 100 : 0;
          const fillColor = getFillRateColor(loc.avgFillRate);

          return (
            <motion.div
              key={loc.location}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-300 truncate max-w-[140px]">
                  {loc.location}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">{loc.totalEvents} events</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      color: fillColor,
                      backgroundColor: `${fillColor}15`,
                    }}
                  >
                    {Math.round(loc.avgFillRate * 100)}% fill
                  </span>
                </div>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: fillColor }}
                />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[9px] text-gray-600">
                  Peak: {loc.peakDay} {loc.peakHour > 12 ? loc.peakHour - 12 : loc.peakHour}
                  {loc.peakHour >= 12 ? "pm" : "am"}
                </span>
                <span className="text-[9px] text-gray-600">
                  {loc.totalRsvps.toLocaleString()} total RSVPs
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
