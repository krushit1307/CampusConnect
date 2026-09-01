/**
 * TopEventsTable — Sortable table showing the top-performing events
 * by attendance, rating, and other key metrics.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, ExternalLink } from "lucide-react";
import { AttendanceRecord, formatPercent, getCategoryColor } from "@/utils/attendanceAnalytics";

interface TopEventsTableProps {
  records: AttendanceRecord[];
  maxRows?: number;
}

type SortField = "attendanceRate" | "checkedIn" | "rsvps" | "noShowCount" | "rating";
type SortDir = "asc" | "desc";

export function TopEventsTable({ records, maxRows = 10 }: TopEventsTableProps) {
  const [sortField, setSortField] = useState<SortField>("attendanceRate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (sortDir === "asc") return (aVal as number) - (bVal as number);
      return (bVal as number) - (aVal as number);
    });
    return copy.slice(0, maxRows);
  }, [records, sortField, sortDir, maxRows]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  const attendanceBadge = (rate: number) => {
    if (rate >= 90) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    if (rate >= 75) return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
    if (rate >= 50) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    return "bg-rose-500/20 text-rose-400 border-rose-500/40";
  };

  const ratingStars = (rating: number | null) => {
    if (rating === null) return <span className="text-gray-600 text-xs">N/A</span>;
    const filled = Math.round(rating);
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`text-[10px] ${i < filled ? "text-amber-400" : "text-gray-700"}`}
          >
            ★
          </span>
        ))}
        <span className="text-gray-400 text-[10px] ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Top Events</h3>
          <p className="text-gray-400 text-xs">
            Ranked by {sortField.replace(/([A-Z])/g, " $1").toLowerCase()}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-white/10">
              <th className="text-left py-3 px-2 font-medium w-8">#</th>
              <th className="text-left py-3 px-2 font-medium">Event</th>
              <th className="text-left py-3 px-2 font-medium">Category</th>
              <th
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort("attendanceRate")}
              >
                <div className="flex items-center justify-end gap-1">
                  Attendance <SortIcon field="attendanceRate" />
                </div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort("checkedIn")}
              >
                <div className="flex items-center justify-end gap-1">
                  Check-ins <SortIcon field="checkedIn" />
                </div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort("rsvps")}
              >
                <div className="flex items-center justify-end gap-1">
                  RSVPs <SortIcon field="rsvps" />
                </div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort("noShowCount")}
              >
                <div className="flex items-center justify-end gap-1">
                  No-Shows <SortIcon field="noShowCount" />
                </div>
              </th>
              <th
                className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort("rating")}
              >
                <div className="flex items-center justify-end gap-1">
                  Rating <SortIcon field="rating" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((record, i) => (
              <motion.tr
                key={record.eventId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.03 }}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-2 text-gray-500 font-mono">{i + 1}</td>
                <td className="py-3 px-2">
                  <div className="text-white font-medium max-w-[200px] truncate">
                    {record.title}
                  </div>
                  <div className="text-gray-500 text-[10px]">
                    {record.clubName} · {record.eventDate}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium border"
                    style={{
                      color: getCategoryColor(record.category),
                      borderColor: `${getCategoryColor(record.category)}40`,
                      backgroundColor: `${getCategoryColor(record.category)}15`,
                    }}
                  >
                    {record.category}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${attendanceBadge(record.attendanceRate)}`}
                  >
                    {formatPercent(record.attendanceRate)}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-white font-medium">{record.checkedIn}</td>
                <td className="py-3 px-2 text-right text-gray-400">{record.rsvps}</td>
                <td className="py-3 px-2 text-right">
                  <span className={record.noShowCount > 10 ? "text-rose-400" : "text-gray-400"}>
                    {record.noShowCount}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">{ratingStars(record.rating)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {records.length > maxRows && (
        <div className="mt-3 text-center text-gray-500 text-[10px]">
          Showing {maxRows} of {records.length} events
        </div>
      )}
    </motion.div>
  );
}
