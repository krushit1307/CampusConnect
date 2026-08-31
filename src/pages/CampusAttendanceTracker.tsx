import React, { useState, useMemo } from "react";
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  TrendingDown, BarChart3, PieChart, Target, Flame, Award, Star,
  Bell, ChevronDown, ChevronUp, Search, Filter, Plus, Minus,
  Eye, EyeOff, RefreshCw, Download, Share2, BookOpen, Users,
  MapPin, ArrowUpRight, ArrowDownRight, Zap, Shield, Heart,
  GraduationCap, Timer, Percent, CalendarDays, Repeat, Hash,
  CircleDot, Layers, Grid, List, Info, Sparkles, Bookmark,
  Coffee, Sunrise, Sun, Moon, Dumbbell, Microscope, Briefcase,
} from "lucide-react";

/* ─────────────── Types ─────────────── */

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "holiday";
type CourseType = "lecture" | "lab" | "tutorial" | "seminar" | "workshop";
type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  type: CourseType;
  credits: number;
  schedule: { day: DayOfWeek; start: string; end: string }[];
  room: string;
  department: string;
  totalClasses: number;
  attendedClasses: number;
  absentClasses: number;
  lateClasses: number;
  excusedClasses: number;
  requiredPercentage: number;
  currentPercentage: number;
  maxAllowedAbsents: number;
  currentAbsents: number;
  color: string;
  semester: string;
}

interface AttendanceRecord {
  id: string;
  courseId: string;
  date: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  duration: number;
  notes: string;
  room: string;
  instructor: string;
  mood: number;
  engagement: number;
}

interface AttendanceStreak {
  courseId: string;
  currentStreak: number;
  longestStreak: number;
  totalPresentDays: number;
  lastAbsentDate: string | null;
  weeklyPattern: Record<DayOfWeek, number>;
}

interface AttendanceAlert {
  id: string;
  courseId: string;
  type: "warning" | "critical" | "info" | "positive";
  message: string;
  action: string;
  timestamp: string;
  dismissed: boolean;
}

interface WeeklyHeatmap {
  week: string;
  days: { day: DayOfWeek; status: AttendanceStatus | null; courseId: string }[];
}

interface AttendancePrediction {
  courseId: string;
  currentPct: number;
  projectedPct: number;
  classesNeeded: number;
  classesToMaintain: number;
  riskLevel: "safe" | "caution" | "danger" | "critical";
  recommendation: string;
}

/* ─────────────── Constants ─────────────── */

const COURSE_COLORS: Record<string, string> = {
  "CS301": "#3B82F6", "MA201": "#10B981", "CS302": "#8B5CF6",
  "EE201": "#F59E0B", "CS303": "#EC4899", "HU101": "#06B6D4",
};

const COURSE_TYPES: Record<CourseType, { icon: React.ReactNode; label: string }> = {
  lecture: { icon: <GraduationCap size={14} />, label: "Lecture" },
  lab: { icon: <Microscope size={14} />, label: "Lab" },
  tutorial: { icon: <BookOpen size={14} />, label: "Tutorial" },
  seminar: { icon: <Users size={14} />, label: "Seminar" },
  workshop: { icon: <Briefcase size={14} />, label: "Workshop" },
};

const STATUS_CONFIG: Record<AttendanceStatus, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  present: { icon: <CheckCircle2 size={14} />, color: "text-green-400", bg: "bg-green-500/20", label: "Present" },
  absent: { icon: <XCircle size={14} />, color: "text-red-400", bg: "bg-red-500/20", label: "Absent" },
  late: { icon: <Clock size={14} />, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Late" },
  excused: { icon: <Shield size={14} />, color: "text-blue-400", bg: "bg-blue-500/20", label: "Excused" },
  holiday: { icon: <Coffee size={14} />, color: "text-gray-400", bg: "bg-gray-500/20", label: "Holiday" },
};

const RISK_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  safe: { color: "text-green-400", bg: "bg-green-500/20", label: "Safe" },
  caution: { color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Caution" },
  danger: { color: "text-orange-400", bg: "bg-orange-500/20", label: "Danger" },
  critical: { color: "text-red-400", bg: "bg-red-500/20", label: "Critical" },
};

/* ─────────────── Sample Data ─────────────── */

const COURSES: Course[] = [
  {
    id: "c1", name: "Data Structures & Algorithms", code: "CS301",
    instructor: "Dr. Raghav Sharma", type: "lecture", credits: 4,
    schedule: [{ day: "Mon", start: "09:00", end: "10:00" }, { day: "Wed", start: "09:00", end: "10:00" }, { day: "Fri", start: "09:00", end: "10:00" }],
    room: "CS-Lab 301", department: "Computer Science", totalClasses: 42, attendedClasses: 39, absentClasses: 2, lateClasses: 1, excusedClasses: 1,
    requiredPercentage: 75, currentPercentage: 92.86, maxAllowedAbsents: 11, currentAbsents: 2, color: "#3B82F6", semester: "Fall 2026",
  },
  {
    id: "c2", name: "Linear Algebra", code: "MA201",
    instructor: "Prof. Meena Iyer", type: "lecture", credits: 3,
    schedule: [{ day: "Tue", start: "10:00", end: "11:00" }, { day: "Thu", start: "10:00", end: "11:00" }],
    room: "Math Hall 201", department: "Mathematics", totalClasses: 28, attendedClasses: 24, absentClasses: 3, lateClasses: 2, excusedClasses: 1,
    requiredPercentage: 75, currentPercentage: 85.71, maxAllowedAbsents: 7, currentAbsents: 3, color: "#10B981", semester: "Fall 2026",
  },
  {
    id: "c3", name: "Operating Systems Lab", code: "CS302",
    instructor: "Dr. Kavitha Nair", type: "lab", credits: 2,
    schedule: [{ day: "Wed", start: "14:00", end: "16:00" }],
    room: "CS-Lab 105", department: "Computer Science", totalClasses: 14, attendedClasses: 13, absentClasses: 1, lateClasses: 0, excusedClasses: 0,
    requiredPercentage: 80, currentPercentage: 92.86, maxAllowedAbsents: 3, currentAbsents: 1, color: "#8B5CF6", semester: "Fall 2026",
  },
  {
    id: "c4", name: "Digital Electronics", code: "EE201",
    instructor: "Prof. Arvind Patel", type: "lecture", credits: 3,
    schedule: [{ day: "Mon", start: "11:00", end: "12:00" }, { day: "Thu", start: "14:00", end: "15:00" }],
    room: "EE Block 204", department: "Electrical Engineering", totalClasses: 28, attendedClasses: 20, absentClasses: 6, lateClasses: 3, excusedClasses: 2,
    requiredPercentage: 75, currentPercentage: 71.43, maxAllowedAbsents: 7, currentAbsents: 6, color: "#F59E0B", semester: "Fall 2026",
  },
  {
    id: "c5", name: "Database Management Systems", code: "CS303",
    instructor: "Dr. Sunita Reddy", type: "lecture", credits: 3,
    schedule: [{ day: "Tue", start: "14:00", end: "15:00" }, { day: "Fri", start: "11:00", end: "12:00" }],
    room: "CS-Lab 302", department: "Computer Science", totalClasses: 28, attendedClasses: 26, absentClasses: 1, lateClasses: 1, excusedClasses: 0,
    requiredPercentage: 75, currentPercentage: 92.86, maxAllowedAbsents: 7, currentAbsents: 1, color: "#EC4899", semester: "Fall 2026",
  },
  {
    id: "c6", name: "Professional Communication", code: "HU101",
    instructor: "Prof. Deepa Menon", type: "seminar", credits: 2,
    schedule: [{ day: "Fri", start: "14:00", end: "15:30" }],
    room: "Seminar Hall A", department: "Humanities", totalClasses: 14, attendedClasses: 12, absentClasses: 2, lateClasses: 0, excusedClasses: 0,
    requiredPercentage: 75, currentPercentage: 85.71, maxAllowedAbsents: 4, currentAbsents: 2, color: "#06B6D4", semester: "Fall 2026",
  },
];

const generateRecords = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const statuses: AttendanceStatus[] = ["present", "present", "present", "present", "present", "present", "present", "present", "late", "absent"];
  const days: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  let id = 1;
  const baseDate = new Date("2026-07-07");
  for (let week = 0; week < 14; week++) {
    for (let d = 0; d < 5; d++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + week * 7 + d);
      const dayName = days[d];
      COURSES.forEach((course) => {
        const hasClass = course.schedule.some((s) => s.day === dayName);
        if (!hasClass) return;
        const sched = course.schedule.find((s) => s.day === dayName)!;
        const rand = Math.random();
        let status: AttendanceStatus = "present";
        if (rand > 0.92) status = "absent";
        else if (rand > 0.88) status = "late";
        else if (rand > 0.86) status = "excused";
        records.push({
          id: `r${id++}`, courseId: course.id, date: date.toISOString().split("T")[0],
          day: dayName, startTime: sched.start, endTime: sched.end, status,
          checkedInAt: status !== "absent" ? `${sched.start}:${String(Math.floor(Math.random() * 5)).padStart(2, "0")}` : null,
          checkedOutAt: status !== "absent" ? sched.end : null,
          duration: status !== "absent" ? 60 : 0, notes: "",
          room: course.room, instructor: course.instructor,
          mood: status === "present" ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 3) + 1,
          engagement: status === "present" ? Math.floor(Math.random() * 40) + 60 : Math.floor(Math.random() * 30) + 10,
        });
      });
    }
  }
  return records;
};

const RECORDS = generateRecords();

const STREAKS: AttendanceStreak[] = COURSES.map((c) => ({
  courseId: c.id,
  currentStreak: c.currentPercentage > 90 ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 5),
  longestStreak: Math.floor(Math.random() * 20) + 10,
  totalPresentDays: c.attendedClasses,
  lastAbsentDate: c.absentClasses > 0 ? "2026-09-10" : null,
  weeklyPattern: { Mon: Math.floor(Math.random() * 3) + 11, Tue: Math.floor(Math.random() * 3) + 10, Wed: Math.floor(Math.random() * 3) + 11, Thu: Math.floor(Math.random() * 3) + 10, Fri: Math.floor(Math.random() * 2) + 6, Sat: 0 },
}));

const ALERTS: AttendanceAlert[] = [
  { id: "a1", courseId: "c4", type: "critical", message: "Digital Electronics attendance is 71.43% — below 75% requirement!", action: "Attend next 3 classes to recover", timestamp: "2026-09-12T10:00:00", dismissed: false },
  { id: "a2", courseId: "c2", type: "warning", message: "Linear Algebra has 3 absents — 4 more and you'll breach the limit", action: "Maintain 100% attendance for 2 weeks", timestamp: "2026-09-11T08:00:00", dismissed: false },
  { id: "a3", courseId: "c1", type: "positive", message: "DS&A attendance is 92.86% — excellent streak of 8 classes!", action: "Keep it up!", timestamp: "2026-09-12T09:00:00", dismissed: false },
  { id: "a4", courseId: "c5", type: "info", message: "DBMS has only 1 absent — attend next 3 classes for 95%+", action: "Easy recovery path available", timestamp: "2026-09-11T14:00:00", dismissed: false },
  { id: "a5", courseId: "c6", type: "warning", message: "Professional Communication has 2 absents in 14 classes", action: "Attend remaining classes to stay above 85%", timestamp: "2026-09-10T15:00:00", dismissed: false },
  { id: "a6", courseId: "c3", type: "positive", message: "OS Lab has 92.86% attendance — only 1 absent!", action: "Perfect attendance possible", timestamp: "2026-09-11T14:00:00", dismissed: false },
];

const PREDICTIONS: AttendancePrediction[] = COURSES.map((c) => {
  const remaining = Math.max(0, c.totalClasses > 40 ? 8 : 6);
  const projected = Math.round(((c.attendedClasses + remaining) / (c.totalClasses + remaining)) * 10000) / 100;
  const classesToMaintain = Math.ceil((c.requiredPercentage / 100) * (c.totalClasses + remaining) - c.attendedClasses);
  const riskLevel = c.currentPercentage >= 90 ? "safe" : c.currentPercentage >= 80 ? "caution" : c.currentPercentage >= 75 ? "danger" : "critical";
  const recommendation = riskLevel === "critical"
    ? `Attend ALL remaining ${remaining} classes. Need ${classesToMaintain} more to reach ${c.requiredPercentage}%`
    : riskLevel === "danger"
    ? `Attend at least ${Math.max(0, classesToMaintain)} of ${remaining} remaining classes`
    : riskLevel === "caution"
    ? `Good buffer. Can skip ${Math.max(0, remaining - classesToMaintain)} more classes safely`
    : `Excellent position. Even missing all remaining classes keeps you above ${c.requiredPercentage}%`;
  return { courseId: c.id, currentPct: c.currentPercentage, projectedPct: projected, classesNeeded: remaining, classesToMaintain: Math.max(0, classesToMaintain), riskLevel, recommendation };
});

const HEATMAP_DATA: { weeks: string[]; data: Record<string, Record<DayOfWeek, AttendanceStatus | null>> } = (() => {
  const weeks = ["Jul W1", "Jul W2", "Jul W3", "Jul W4", "Aug W1", "Aug W2", "Aug W3", "Aug W4", "Sep W1", "Sep W2"];
  const data: Record<string, Record<DayOfWeek, AttendanceStatus | null>> = {};
  const days: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  weeks.forEach((w) => {
    data[w] = { Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null };
    days.forEach((d) => {
      const rand = Math.random();
      data[w][d] = rand > 0.12 ? "present" : rand > 0.06 ? "late" : "absent";
    });
  });
  return { weeks, data };
})();

/* ─────────────── Utilities ─────────────── */

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

/* ─────────────── Sub-Components ─────────────── */

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; trend?: string; trendUp?: boolean }> = ({ icon, label, value, sub, color = "text-white", trend, trendUp }) => (
  <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    {trend && <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? "text-green-400" : "text-red-400"}`}>{trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{trend}</div>}
  </div>
);

const AttendanceRing: React.FC<{ percentage: number; required: number; size?: number; strokeWidth?: number }> = ({ percentage, required, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const requiredOffset = circumference - (required / 100) * circumference;
  const color = percentage >= required + 10 ? "#10B981" : percentage >= required ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={requiredOffset} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{percentage.toFixed(1)}%</span>
        <span className="text-[10px] text-gray-500">min {required}%</span>
      </div>
    </div>
  );
};

const StreakBadge: React.FC<{ streak: number; label?: string }> = ({ streak, label = "streak" }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
    streak >= 10 ? "bg-orange-500/20 text-orange-400" :
    streak >= 5 ? "bg-yellow-500/20 text-yellow-400" :
    streak >= 3 ? "bg-green-500/20 text-green-400" :
    "bg-white/10 text-gray-400"
  }`}>
    <Flame size={14} className={streak >= 10 ? "text-orange-400" : streak >= 5 ? "text-yellow-400" : ""} />
    <span>{streak} {label}</span>
  </div>
);

const CourseCard: React.FC<{ course: Course; streak: AttendanceStreak; prediction: AttendancePrediction; selected: boolean; onSelect: () => void }> = ({ course, streak, prediction, selected, onSelect }) => {
  const riskCfg = RISK_CONFIG[prediction.riskLevel];
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl p-4 border transition-all ${
        selected ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
          <div>
            <span className="font-semibold text-white text-sm">{course.name}</span>
            <div className="text-[10px] text-gray-500">{course.code} · {course.instructor}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>{riskCfg.label}</span>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <AttendanceRing percentage={course.currentPercentage} required={course.requiredPercentage} size={80} strokeWidth={6} />
        <div className="flex-1 space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-gray-400">Attended</span><span className="text-white">{course.attendedClasses}/{course.totalClasses}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Absent</span><span className={course.currentAbsents >= course.maxAllowedAbsents - 2 ? "text-red-400" : "text-white"}>{course.currentAbsents}/{course.maxAllowedAbsents}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Late</span><span className="text-yellow-400">{course.lateClasses}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Credits</span><span className="text-white">{course.credits}</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StreakBadge streak={streak.currentStreak} />
        <span className="text-[10px] text-gray-500">Best: {streak.longestStreak}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {course.schedule.map((s) => (
          <span key={`${s.day}${s.start}`} className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">
            {s.day} {s.start}-{s.end}
          </span>
        ))}
        <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400">📍 {course.room}</span>
      </div>
    </div>
  );
};

const AlertCard: React.FC<{ alert: AttendanceAlert; onDismiss: (id: string) => void }> = ({ alert, onDismiss }) => {
  const cfg = {
    critical: { icon: <AlertTriangle size={16} />, border: "border-red-400/30", bg: "bg-red-500/5", text: "text-red-400" },
    warning: { icon: <AlertTriangle size={16} />, border: "border-yellow-400/30", bg: "bg-yellow-500/5", text: "text-yellow-400" },
    info: { icon: <Info size={16} />, border: "border-blue-400/30", bg: "bg-blue-500/5", text: "text-blue-400" },
    positive: { icon: <Sparkles size={16} />, border: "border-green-400/30", bg: "bg-green-500/5", text: "text-green-400" },
  }[alert.type];
  const course = COURSES.find((c) => c.id === alert.courseId);
  return (
    <div className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg} transition-all`}>
      <div className="flex items-start gap-3">
        <span className={cfg.text}>{cfg.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-white">{course?.code}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{alert.type}</span>
          </div>
          <p className="text-sm text-gray-300">{alert.message}</p>
          <p className="text-xs text-gray-500 mt-1">💡 {alert.action}</p>
        </div>
        <button onClick={() => onDismiss(alert.id)} className="text-gray-500 hover:text-white transition"><XCircle size={16} /></button>
      </div>
    </div>
  );
};

const PredictionCard: React.FC<{ prediction: AttendancePrediction; course: Course }> = ({ prediction, course }) => {
  const riskCfg = RISK_CONFIG[prediction.riskLevel];
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: course.color }} />
          <span className="text-sm font-semibold text-white">{course.code}</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>{riskCfg.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
        <div><div className="text-gray-500 mb-0.5">Current</div><div className="text-white font-bold">{prediction.currentPct}%</div></div>
        <div><div className="text-gray-500 mb-0.5">Projected</div><div className={`font-bold ${prediction.projectedPct >= prediction.currentPct ? "text-green-400" : "text-red-400"}`}>{prediction.projectedPct}%</div></div>
        <div><div className="text-gray-500 mb-0.5">Need</div><div className="text-white font-bold">{prediction.classesToMaintain}/{prediction.classesNeeded}</div></div>
      </div>
      <div className="bg-white/5 rounded-lg p-2 text-[11px] text-gray-400">{prediction.recommendation}</div>
    </div>
  );
};

const WeeklyHeatmap: React.FC = () => {
  const days: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-cyan-400" />Attendance Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="text-gray-500 text-left py-1 px-2">Week</th>
              {days.map((d) => <th key={d} className="text-gray-500 text-center py-1 px-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_DATA.weeks.map((week) => (
              <tr key={week}>
                <td className="text-gray-400 py-1 px-2 whitespace-nowrap">{week}</td>
                {days.map((d) => {
                  const status = HEATMAP_DATA.data[week][d];
                  const bg = status === "present" ? "bg-green-500" : status === "late" ? "bg-yellow-500" : status === "absent" ? "bg-red-500" : "bg-white/5";
                  return <td key={d} className="py-1 px-2"><div className={`w-8 h-8 rounded ${bg} flex items-center justify-center text-white/80`}>{status === "present" ? "✓" : status === "late" ? "⏰" : status === "absent" ? "✗" : "—"}</div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" />Present</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" />Late</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" />Absent</span>
      </div>
    </div>
  );
};

/* ─────────────── Main Component ─────────────── */

export default function CampusAttendanceTracker() {
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "records" | "predictions" | "alerts" | "heatmap">("overview");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(COURSES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<CourseType | "all">("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [recordFilter, setRecordFilter] = useState<AttendanceStatus | "all">("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [alerts, setAlerts] = useState(ALERTS);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedMood, setSelectedMood] = useState(3);

  const overallStats = useMemo(() => {
    const totalClasses = COURSES.reduce((s, c) => s + c.totalClasses, 0);
    const totalAttended = COURSES.reduce((s, c) => s + c.attendedClasses, 0);
    const totalAbsent = COURSES.reduce((s, c) => s + c.absentClasses, 0);
    const totalLate = COURSES.reduce((s, c) => s + c.lateClasses, 0);
    const overallPct = pct(totalAttended, totalClasses);
    const creditsAtRisk = COURSES.filter((c) => c.currentPercentage < c.requiredPercentage + 5).reduce((s, c) => s + c.credits, 0);
    const totalCredits = COURSES.reduce((s, c) => s + c.credits, 0);
    const weightedPct = COURSES.reduce((s, c) => s + (c.currentPercentage * c.credits), 0) / totalCredits;
    return { totalClasses, totalAttended, totalAbsent, totalLate, overallPct, creditsAtRisk, totalCredits, weightedPct: Math.round(weightedPct * 100) / 100 };
  }, []);

  const filteredCourses = useMemo(() => {
    let result = [...COURSES];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q));
    }
    if (filterType !== "all") result = result.filter((c) => c.type === filterType);
    if (filterRisk !== "all") {
      const pred = PREDICTIONS.find((p) => p.riskLevel === filterRisk);
      if (pred) result = result.filter((c) => PREDICTIONS.find((p) => p.courseId === c.id)?.riskLevel === filterRisk);
    }
    return result;
  }, [searchQuery, filterType, filterRisk]);

  const filteredRecords = useMemo(() => {
    let result = [...RECORDS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (selectedCourse) result = result.filter((r) => r.courseId === selectedCourse.id);
    if (recordFilter !== "all") result = result.filter((r) => r.status === recordFilter);
    if (recordSearch) {
      const q = recordSearch.toLowerCase();
      result = result.filter((r) => r.date.includes(q) || r.instructor.toLowerCase().includes(q) || r.room.toLowerCase().includes(q));
    }
    return result.slice(0, 50);
  }, [selectedCourse, recordFilter, recordSearch]);

  const dismissAlert = (id: string) => setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));

  const todaySchedule = useMemo(() => {
    const today = new Date();
    const dayNames: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayName = dayNames[today.getDay()];
    return COURSES.flatMap((c) => c.schedule.filter((s) => s.day === todayName).map((s) => ({ ...c, ...s }))).sort((a, b) => a.start.localeCompare(b.start));
  }, []);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <BarChart3 size={14} /> },
    { id: "courses" as const, label: "Courses", icon: <BookOpen size={14} /> },
    { id: "records" as const, label: "Records", icon: <Calendar size={14} /> },
    { id: "predictions" as const, label: "Predictions", icon: <Target size={14} /> },
    { id: "alerts" as const, label: "Alerts", icon: <Bell size={14} /> },
    { id: "heatmap" as const, label: "Heatmap", icon: <Layers size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
              <CalendarDays size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Attendance Tracker</h1>
              <p className="text-gray-400 text-sm">Track · Predict · Improve · Graduate</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCheckIn(!showCheckIn)} className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500/30 transition border border-green-400/30">
              <CheckCircle2 size={14} />Check In
            </button>
            <button className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition">
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KpiCard icon={<CalendarDays size={18} />} label="Overall" value={`${overallStats.overallPct}%`} sub="across all courses" color="text-cyan-400" />
          <KpiCard icon={<Target size={18} />} label="Weighted" value={`${overallStats.weightedPct}%`} sub="credit-weighted" color="text-green-400" trend="+2% this month" trendUp />
          <KpiCard icon={<CheckCircle2 size={18} />} label="Present" value={overallStats.totalAttended} sub={`of ${overallStats.totalClasses} classes`} color="text-green-400" />
          <KpiCard icon={<Flame size={18} />} label="Best Streak" value={`${Math.max(...STREAKS.map((s) => s.longestStreak))}`} sub="consecutive classes" color="text-orange-400" />
          <KpiCard icon={<AlertTriangle size={18} />} label="At Risk" value={overallStats.creditsAtRisk} sub={`of ${overallStats.totalCredits} credits`} color={overallStats.creditsAtRisk > 0 ? "text-red-400" : "text-green-400"} />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? "bg-blue-500/20 text-blue-400 border border-blue-400/30" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}{tab.label}
              {tab.id === "alerts" && !alerts.every((a) => a.dismissed) && <span className="w-2 h-2 rounded-full bg-red-400" />}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Today's Schedule */}
            {todaySchedule.length > 0 && (
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Sun size={16} className="text-yellow-400" />Today's Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {todaySchedule.map((cls) => {
                    const course = COURSES.find((c) => c.id === cls.id)!;
                    const streak = STREAKS.find((s) => s.courseId === cls.id)!;
                    return (
                      <div key={`${cls.id}-${cls.start}`} className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center gap-3">
                        <div className="w-1 h-12 rounded-full" style={{ backgroundColor: course.color }} />
                        <div>
                          <div className="text-sm text-white font-medium">{course.name}</div>
                          <div className="text-[10px] text-gray-500">{cls.start} - {cls.end} · {course.room}</div>
                        </div>
                        <div className="ml-auto text-right">
                          <StreakBadge streak={streak.currentStreak} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Course Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {COURSES.map((course) => {
                const streak = STREAKS.find((s) => s.courseId === course.id)!;
                const prediction = PREDICTIONS.find((p) => p.courseId === course.id)!;
                return (
                  <CourseCard
                    key={course.id} course={course} streak={streak} prediction={prediction}
                    selected={selectedCourse?.id === course.id}
                    onSelect={() => { setSelectedCourse(course); setActiveTab("records"); }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === "courses" && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-gray-400 mr-2" />
                <input type="text" placeholder="Search courses, instructors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white text-sm outline-none flex-1" />
              </div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Types</option>
                {Object.entries(COURSE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                <option value="all">All Risk</option>
                {Object.entries(RISK_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCourses.map((course) => {
                const streak = STREAKS.find((s) => s.courseId === course.id)!;
                const prediction = PREDICTIONS.find((p) => p.courseId === course.id)!;
                return (
                  <CourseCard key={course.id} course={course} streak={streak} prediction={prediction} selected={selectedCourse?.id === course.id} onSelect={() => setSelectedCourse(course)} />
                );
              })}
            </div>
          </div>
        )}

        {/* Records Tab */}
        {activeTab === "records" && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-white">
                Attendance Records {selectedCourse && <span className="text-gray-400 text-sm">— {selectedCourse.name}</span>}
              </h2>
              <div className="flex gap-2">
                <select value={selectedCourse?.id || ""} onChange={(e) => setSelectedCourse(COURSES.find((c) => c.id === e.target.value) || null)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                  <option value="">All Courses</option>
                  {COURSES.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
                <select value={recordFilter} onChange={(e) => setRecordFilter(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Day</th>
                      <th className="text-left py-3 px-4">Course</th>
                      <th className="text-left py-3 px-4">Time</th>
                      <th className="text-left py-3 px-4">Room</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Check-in</th>
                      <th className="text-right py-3 px-4">Mood</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => {
                      const course = COURSES.find((c) => c.id === record.courseId);
                      const statusCfg = STATUS_CONFIG[record.status];
                      return (
                        <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="py-2.5 px-4 text-white font-mono">{record.date}</td>
                          <td className="py-2.5 px-4 text-gray-400">{record.day}</td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: course?.color }} />
                              <span className="text-white">{course?.code}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-gray-300">{record.startTime} - {record.endTime}</td>
                          <td className="py-2.5 px-4 text-gray-400">{record.room}</td>
                          <td className="py-2.5 px-4">
                            <span className={`flex items-center gap-1 ${statusCfg.color}`}>
                              {statusCfg.icon}{statusCfg.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-gray-400 font-mono">{record.checkedInAt || "—"}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span>{["😔", "😐", "🙂", "😊", "🤩"][record.mood - 1]}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-gray-500"><Calendar size={32} className="mx-auto mb-2 opacity-50" /><p>No records found</p></div>
              )}
            </div>
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === "predictions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Target size={18} className="text-cyan-400" />Attendance Predictions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PREDICTIONS.map((pred) => {
                const course = COURSES.find((c) => c.id === pred.courseId)!;
                return <PredictionCard key={pred.courseId} prediction={pred} course={course} />;
              })}
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Sparkles size={16} className="text-purple-400" />Smart Recommendations</h3>
              <div className="space-y-2">
                {[
                  { icon: <AlertTriangle size={14} />, text: "Digital Electronics (EE201) needs immediate attention — attend ALL remaining classes", color: "border-red-400/30 bg-red-500/5 text-red-400" },
                  { icon: <Target size={14} />, text: "Linear Algebra (MA201) has a thin margin — attend next 4 classes consecutively", color: "border-yellow-400/30 bg-yellow-500/5 text-yellow-400" },
                  { icon: <CheckCircle2 size={14} />, text: "DS&A, OS Lab, and DBMS are in safe zones — maintain current pace", color: "border-green-400/30 bg-green-500/5 text-green-400" },
                  { icon: <Flame size={14} />, text: "Build a 15-class streak in any course to unlock the 'Dedication' badge", color: "border-orange-400/30 bg-orange-500/5 text-orange-400" },
                  { icon: <Star size={14} />, text: "Weighted attendance is 89.2% — aim for 92%+ by semester end for Dean's List", color: "border-cyan-400/30 bg-cyan-500/5 text-cyan-400" },
                ].map((rec, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${rec.color}`}>
                    <span className="mt-0.5">{rec.icon}</span>
                    <span className="text-xs text-gray-300">{rec.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <div className="max-w-3xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Bell size={18} className="text-red-400" />Attendance Alerts</h2>
            {alerts.filter((a) => !a.dismissed).length === 0 ? (
              <div className="text-center py-12 text-gray-500"><CheckCircle2 size={48} className="mx-auto mb-3 opacity-50" /><p>All alerts dismissed!</p></div>
            ) : (
              alerts.filter((a) => !a.dismissed).map((alert) => <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />)
            )}
          </div>
        )}

        {/* Heatmap Tab */}
        {activeTab === "heatmap" && (
          <div className="space-y-4">
            <WeeklyHeatmap />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Day-of-Week Distribution */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-blue-400" />Day-of-Week Pattern</h3>
                <div className="space-y-2">
                  {(["Mon", "Tue", "Wed", "Thu", "Fri"] as DayOfWeek[]).map((day) => {
                    const total = STREAKS.reduce((s, st) => s + st.weeklyPattern[day], 0);
                    const maxTotal = Math.max(...(["Mon", "Tue", "Wed", "Thu", "Fri"] as DayOfWeek[]).map((d) => STREAKS.reduce((s, st) => s + st.weeklyPattern[d], 0)));
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-8">{day}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-3">
                          <div className="bg-blue-400 h-3 rounded-full" style={{ width: `${pct(total, maxTotal)}%` }} />
                        </div>
                        <span className="text-xs text-gray-300 w-8 text-right">{total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-400" />Monthly Trend</h3>
                <div className="flex items-end gap-2 h-36">
                  {[
                    { month: "Jul", pct: 94 }, { month: "Aug", pct: 91 }, { month: "Sep", pct: 89 },
                  ].map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{m.pct}%</span>
                      <div className="w-full rounded-t bg-green-400" style={{ height: `${m.pct}%` }} />
                      <span className="text-[10px] text-gray-500">{m.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Check-In Modal */}
        {showCheckIn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCheckIn(false)}>
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2"><CheckCircle2 size={18} className="text-green-400" />Check In</h3>
                <button onClick={() => setShowCheckIn(false)}><XCircle size={20} className="text-gray-400 hover:text-white transition" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Select Course</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none">
                    {COURSES.filter((c) => c.schedule.some((s) => s.day === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()])).map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">How are you feeling?</label>
                  <div className="flex items-center justify-center gap-4">
                    {["😔", "😐", "🙂", "😊", "🤩"].map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedMood(i + 1)}
                        className={`text-2xl p-2 rounded-lg transition-all ${selectedMood === i + 1 ? "bg-white/10 scale-125 ring-2 ring-cyan-400" : "hover:bg-white/5"}`}
                      >{emoji}</button>
                    ))}
                  </div>
                </div>
                <div className="text-center text-xs text-gray-500">
                  {new Date().toLocaleString()} · {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()]}
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowCheckIn(false)} className="flex-1 bg-white/5 text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition border border-white/10">Cancel</button>
                <button onClick={() => { alert("✅ Checked in successfully!"); setShowCheckIn(false); }} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition">Check In</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
