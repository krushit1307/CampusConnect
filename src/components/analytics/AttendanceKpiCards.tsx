/**
 * AttendanceKpiCards — Row of Key Performance Indicator cards
 * displayed at the top of the analytics dashboard.
 */

import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  UserCheck,
  TrendingUp,
  Star,
  AlertTriangle,
  MapPin,
  Percent,
} from "lucide-react";
import { DashboardStats, formatNumber, formatPercent } from "@/utils/attendanceAnalytics";

interface KpiCardsProps {
  stats: DashboardStats;
}

interface KpiItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  bgColor: string;
}

function buildKpiItems(stats: DashboardStats): KpiItem[] {
  return [
    {
      icon: <Calendar className="w-5 h-5" />,
      label: "Total Events",
      value: stats.totalEvents.toString(),
      sub: "Across all categories",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: "Total RSVPs",
      value: formatNumber(stats.totalRSVPs),
      sub: `${formatNumber(stats.totalCapacity)} total capacity`,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      icon: <UserCheck className="w-5 h-5" />,
      label: "Checked In",
      value: formatNumber(stats.totalCheckIns),
      sub: `${formatPercent(stats.conversionRate)} RSVP → check-in`,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: "Avg Attendance",
      value: formatPercent(stats.avgAttendanceRate),
      sub: "Of RSVP'd attendees",
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: "No-Shows",
      value: formatNumber(stats.noShowTotal),
      sub: "RSVP'd but didn't attend",
      color: "text-rose-400",
      bgColor: "bg-rose-500/20",
    },
    {
      icon: <Star className="w-5 h-5" />,
      label: "Avg Rating",
      value: stats.avgRating !== null ? stats.avgRating.toFixed(1) : "N/A",
      sub: "From post-event reviews",
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    {
      icon: <MapPin className="w-5 h-5" />,
      label: "Peak Day",
      value:
        stats.peakAttendanceDate !== "N/A"
          ? new Date(stats.peakAttendanceDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "N/A",
      sub: "Highest check-in count",
      color: "text-teal-400",
      bgColor: "bg-teal-500/20",
    },
    {
      icon: <Percent className="w-5 h-5" />,
      label: "Top Club",
      value: stats.mostActiveClub,
      sub: "By total RSVPs",
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/20",
    },
  ];
}

export function AttendanceKpiCards({ stats }: KpiCardsProps) {
  const items = buildKpiItems(stats);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`p-2.5 rounded-xl ${item.bgColor} ${item.color} group-hover:scale-110 transition-transform`}
            >
              {item.icon}
            </div>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">
              {item.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{item.value}</div>
          <div className="text-[11px] text-gray-500 mt-1">{item.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
