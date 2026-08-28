import React, { useState } from "react";
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  Star,
  BookOpen,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  FileText,
  Zap,
  Target,
  TrendingUp,
  Plus,
  ArrowRight,
  Award,
  Layers,
  BarChart3,
  CheckCircle2,
  XCircle,
  Hash,
  Sparkles,
  Send,
  Bookmark,
  Share2,
  Eye,
  CircleDot,
} from "lucide-react";
import {
  useStudyGroupFinder,
  SUBJECTS,
  STATUS_MAP,
  SIZE_MAP,
  FREQUENCY_MAP,
} from "@/hooks/useStudyGroupFinder";
import type {
  StudyGroup,
  StudySubject,
  StudyGroupStatus,
  StudyGroupSortOption,
  StudyGroupViewMode,
} from "@/hooks/useStudyGroupFinder";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress?: number;
}) {
  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition-all hover:scale-[1.02] duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-slate-500">{unit}</span>
      </div>
      {progress !== undefined && (
        <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  onJoin,
  onLeave,
  onSelect,
}: {
  group: StudyGroup;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const subject = SUBJECTS[group.subject];
  const status = STATUS_MAP[group.status];
  const sizeInfo = SIZE_MAP[group.size];
  const freqInfo = FREQUENCY_MAP[group.meetingFrequency];
  const spotsLeft = group.maxMembers - group.currentMembers;
  const pctFull = Math.round((group.currentMembers / group.maxMembers) * 100);

  return (
    <div
      className={`rounded-2xl border transition-all cursor-pointer ${
        group.isJoined
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-slate-900/60 border-slate-800/60 hover:border-slate-700"
      }`}
      onClick={() => onSelect(group.id)}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${subject.bg} ${subject.color} ${subject.border}`}
            >
              {subject.icon} {subject.label.toUpperCase()}
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400">
              {group.avgRating}
            </span>
          </div>
        </div>

        {/* Title + Course */}
        <h3 className="text-base font-bold text-slate-100 mb-1">{group.name}</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-indigo-400">{group.courseCode}</span>
          <span className="text-[10px] text-slate-500">•</span>
          <span className="text-[10px] text-slate-400">{group.course}</span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{group.description}</p>

        {/* Meta Row */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 flex-wrap mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {group.nextSession}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {group.nextSessionTime}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {group.campusBuilding}
          </span>
          <span className="flex items-center gap-1">
            {freqInfo.icon} {freqInfo.label}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {group.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400"
            >
              #{tag}
            </span>
          ))}
          {group.tags.length > 4 && (
            <span className="text-[9px] font-mono text-slate-600">+{group.tags.length - 4}</span>
          )}
        </div>

        {/* Capacity + Actions */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-slate-500">
              {sizeInfo.label} Group ({sizeInfo.range} members)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {group.currentMembers}/{group.maxMembers}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pctFull >= 90 ? "bg-red-500" : pctFull >= 70 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${pctFull}%` }}
            />
          </div>
        </div>

        {/* Members Preview + Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {group.members.slice(0, 4).map((m, i) => (
                <div
                  key={m.id}
                  className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-300"
                  style={{ zIndex: 4 - i }}
                >
                  {m.name.charAt(0)}
                </div>
              ))}
              {group.currentMembers > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[9px] font-mono text-slate-500">
                  +{group.currentMembers - 4}
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 ml-1">
              {group.attendanceRate}% attendance
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Less" : "More"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (group.isJoined) {
                  onLeave(group.id);
                } else {
                  onJoin(group.id);
                }
              }}
              disabled={group.status === "full" && !group.isJoined}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                group.isJoined
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : group.status === "full"
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
              }`}
            >
              {group.isJoined ? "✓ Joined" : group.status === "full" ? "Full" : "Join"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/40 pt-4 space-y-3">
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              Members ({group.currentMembers})
            </span>
            <div className="flex flex-wrap gap-2">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-2.5 py-1.5"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-300">
                    {m.name.charAt(0)}
                  </div>
                  <span className="text-[10px] text-slate-300">{m.name}</span>
                  {m.role !== "member" && (
                    <span className="text-[8px] font-mono text-amber-400 bg-amber-500/10 px-1 rounded">
                      {m.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              Recent Materials
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <FileText className="w-3 h-3 text-indigo-400" />
              {group.materialCount} resources shared
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> {group.messages.length} messages
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {group.sessions.length} sessions held
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupDetailModal({
  group,
  onClose,
  onJoin,
  onLeave,
  onSendMessage,
  onRate,
}: {
  group: StudyGroup;
  onClose: () => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onSendMessage: (id: string, content: string) => void;
  onRate: (id: string, rating: number) => void;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<
    "chat" | "sessions" | "members" | "resources"
  >("chat");
  const [messageText, setMessageText] = useState("");
  const [userRating, setUserRating] = useState(0);

  const subject = SUBJECTS[group.subject];
  const status = STATUS_MAP[group.status];

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(group.id, messageText.trim());
      setMessageText("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${subject.bg} ${subject.color} ${subject.border}`}
                >
                  {subject.icon} {subject.label.toUpperCase()}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}
                >
                  {status.label}
                </span>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1">{group.name}</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-indigo-400">{group.courseCode}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">{group.course}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {group.avgRating} (
                {group.totalRatings} ratings)
              </span>
            </div>
            <p className="text-sm text-slate-400">{group.description}</p>

            {/* Rate if joined */}
            {group.isJoined && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500">Rate this group:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => {
                      setUserRating(star);
                      onRate(group.id, star);
                    }}
                    className="transition"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= userRating
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-600 hover:text-slate-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800">
          {[
            {
              key: "chat" as const,
              label: "Chat",
              icon: <MessageCircle className="w-3.5 h-3.5" />,
            },
            {
              key: "sessions" as const,
              label: "Sessions",
              icon: <Calendar className="w-3.5 h-3.5" />,
            },
            { key: "members" as const, label: "Members", icon: <Users className="w-3.5 h-3.5" /> },
            {
              key: "resources" as const,
              label: "Resources",
              icon: <FileText className="w-3.5 h-3.5" />,
            },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveDetailTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition ${
                activeDetailTab === key
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Detail Content */}
        <div className="p-4 overflow-y-auto max-h-[45vh]">
          {activeDetailTab === "chat" && (
            <div className="space-y-3">
              {group.messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                group.messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                      {msg.authorName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-slate-200">{msg.authorName}</span>
                        <span className="text-[9px] font-mono text-slate-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{msg.content}</p>
                      {msg.reactions.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {msg.reactions.map((r, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded"
                            >
                              {r.emoji} {r.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeDetailTab === "sessions" && (
            <div className="space-y-2">
              {group.sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No sessions recorded yet.</p>
                </div>
              ) : (
                group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200">{session.topic}</span>
                      <span className="text-[9px] font-mono text-slate-500">{session.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {session.startTime}–{session.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {session.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> {session.attended.length} attended
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-[10px] text-slate-500 italic mt-1">{session.notes}</p>
                    )}
                  </div>
                ))
              )}
              <div className="bg-slate-950/40 rounded-xl p-3 border border-dashed border-slate-700">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold">Next Session:</span>
                  <span>
                    {group.nextSession} at {group.nextSessionTime}
                  </span>
                  <span className="text-slate-500">• {group.location}</span>
                </div>
              </div>
            </div>
          )}

          {activeDetailTab === "members" && (
            <div className="space-y-2">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-3 py-2.5 border border-slate-800/40"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-200">{member.name}</span>
                    {member.role !== "member" && (
                      <span className="ml-2 text-[8px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded capitalize">
                        {member.role}
                      </span>
                    )}
                    <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                      Joined {member.joinedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeDetailTab === "resources" && (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">{group.materialCount} shared resources</p>
              <button className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition">
                Browse Resources
              </button>
            </div>
          )}
        </div>

        {/* Chat Input (if on chat tab) */}
        {activeDetailTab === "chat" && group.isJoined && (
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                onClick={handleSend}
                disabled={!messageText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Join / Leave Footer */}
        {!group.isJoined && group.status !== "full" && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => onJoin(group.id)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-indigo-500/20"
            >
              Join {group.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectBreakdownChart({
  subjectBreakdown,
}: {
  subjectBreakdown: Record<StudySubject, number>;
}) {
  const entries = Object.entries(subjectBreakdown) as [StudySubject, number][];
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-3">
      {entries.map(([subject, count]) => {
        const info = SUBJECTS[subject];
        return (
          <div key={subject}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>{info.icon}</span> {info.label}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">{count}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${info.color.replace("text-", "from-")}`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StudyGroupFinder() {
  const {
    groups,
    filteredGroups,
    stats,
    resources,
    subjectFilter,
    setSubjectFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    joinGroup,
    leaveGroup,
    createGroup,
    sendMessage,
    rateGroup,
    getRecommendedGroups,
    getUpcomingSessions,
  } = useStudyGroupFinder();

  const [activeTab, setActiveTab] = useState<"discover" | "my-groups" | "calendar" | "analytics">(
    "discover",
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : null;
  const myGroups = groups.filter((g) => g.isJoined);
  const recommended = getRecommendedGroups();
  const upcomingSessions = getUpcomingSessions();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-indigo-900/50 via-purple-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Study Groups
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              Study Group Finder
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Find your study crew. Join groups by subject, track sessions, share materials, and ace
              your courses together.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-indigo-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {[
              { key: "discover" as const, label: "Discover", icon: <Search className="w-4 h-4" /> },
              {
                key: "my-groups" as const,
                label: "My Groups",
                icon: <Bookmark className="w-4 h-4" />,
              },
              {
                key: "calendar" as const,
                label: "Schedule",
                icon: <Calendar className="w-4 h-4" />,
              },
              {
                key: "analytics" as const,
                label: "Analytics",
                icon: <BarChart3 className="w-4 h-4" />,
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                  activeTab === key
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<Users className="w-5 h-5" />}
            label="Groups Joined"
            value={stats.joinedGroups.toString()}
            unit={`of ${stats.totalGroups}`}
            color="text-indigo-400"
            bgColor="bg-indigo-500/10"
            borderColor="border-indigo-500/30"
            progress={(stats.joinedGroups / stats.totalGroups) * 100}
          />
          <KPICard
            icon={<Clock className="w-5 h-5" />}
            label="Study Hours"
            value={stats.studyHours.toFixed(1)}
            unit="hours"
            color="text-cyan-400"
            bgColor="bg-cyan-500/10"
            borderColor="border-cyan-500/30"
            progress={(stats.currentWeekHours / stats.weeklyGoalHours) * 100}
          />
          <KPICard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Study Streak"
            value={stats.streakDays.toString()}
            unit="days"
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
          />
          <KPICard
            icon={<Target className="w-5 h-5" />}
            label="Top Subject"
            value={stats.strongestSubject}
            unit=""
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
          />
        </div>

        {/* Discover Tab */}
        {activeTab === "discover" && (
          <div className="space-y-4">
            {/* Search + Filters */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search groups, courses, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setSubjectFilter("all")}
                  className={`px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                    subjectFilter === "all"
                      ? "bg-slate-700 border-slate-600 text-slate-200"
                      : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  All
                </button>
                {(
                  Object.entries(SUBJECTS) as [StudySubject, (typeof SUBJECTS)[StudySubject]][]
                ).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSubjectFilter(key)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                      subjectFilter === key
                        ? `${info.bg} ${info.color} ${info.border}`
                        : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {info.icon} {info.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort + View + Status */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Sort:</span>
                {(
                  [
                    "relevance",
                    "members",
                    "nextSession",
                    "rating",
                    "newest",
                  ] as StudyGroupSortOption[]
                ).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition ${
                      sortBy === opt
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {opt === "relevance"
                      ? "🔥 Relevance"
                      : opt === "members"
                        ? "👥 Members"
                        : opt === "nextSession"
                          ? "📅 Next"
                          : opt === "rating"
                            ? "⭐ Rating"
                            : "🆕 Newest"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Status:</span>
                {(["all", "active", "upcoming", "full"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition ${
                      statusFilter === s
                        ? "bg-slate-700 border border-slate-600 text-slate-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {s === "all" ? "All" : STATUS_MAP[s].label}
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-2 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1 rounded ${viewMode === "grid" ? "bg-slate-700 text-white" : "text-slate-500"}`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1 rounded ${viewMode === "list" ? "bg-slate-700 text-white" : "text-slate-500"}`}
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Recommended Section */}
            {recommended.length > 0 && !searchQuery && subjectFilter === "all" && (
              <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-mono font-bold text-indigo-300 uppercase tracking-wider">
                    Recommended for You
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {recommended.slice(0, 3).map((group) => {
                    const sub = SUBJECTS[group.subject];
                    return (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className="flex items-center gap-3 bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 hover:border-indigo-500/30 transition text-left"
                      >
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${sub.bg} border ${sub.border}`}
                        >
                          {sub.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-200 truncate">
                            {group.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 text-amber-400" /> {group.avgRating}
                            </span>
                            <span>
                              {group.currentMembers}/{group.maxMembers} members
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Group Cards Grid */}
            <div
              className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
            >
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onJoin={joinGroup}
                  onLeave={leaveGroup}
                  onSelect={setSelectedGroupId}
                />
              ))}
            </div>

            {filteredGroups.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">No study groups found</h3>
                <p className="text-slate-600 text-sm mt-1">
                  Try adjusting your filters or create a new group
                </p>
              </div>
            )}
          </div>
        )}

        {/* My Groups Tab */}
        {activeTab === "my-groups" && (
          <div className="space-y-5">
            {/* Weekly Goal */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" /> Weekly Goal
                </h3>
                <span className="text-xs font-mono text-cyan-400">
                  {stats.currentWeekHours}/{stats.weeklyGoalHours} hours
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                  style={{
                    width: `${Math.min((stats.currentWeekHours / stats.weeklyGoalHours) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* My Groups List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onJoin={joinGroup}
                  onLeave={leaveGroup}
                  onSelect={setSelectedGroupId}
                />
              ))}
            </div>
            {myGroups.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <Bookmark className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">
                  You haven't joined any groups yet
                </h3>
                <p className="text-slate-600 text-sm mt-1">Head to Discover to find study groups</p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === "calendar" && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Upcoming Sessions
                </h3>
              </div>
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No upcoming sessions scheduled.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingSessions.map(({ group, session }) => {
                    const sub = SUBJECTS[group.subject];
                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-4 bg-slate-950/40 rounded-xl px-4 py-3 border border-slate-800/40 hover:border-slate-700/60 transition cursor-pointer"
                        onClick={() => setSelectedGroupId(group.id)}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${sub.bg} border ${sub.border}`}
                        >
                          {sub.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-200 truncate">
                            {session.topic}
                          </h4>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                            <span>{group.name}</span>
                            <span className="text-indigo-400">{session.date}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {session.startTime}–
                              {session.endTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" /> {session.location}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Group Schedule Overview */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Your Schedule by Group
                </h3>
              </div>
              <div className="space-y-3">
                {myGroups.map((group) => {
                  const freq = FREQUENCY_MAP[group.meetingFrequency];
                  return (
                    <div
                      key={group.id}
                      className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-4 py-3 border border-slate-800/40"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-sm">
                        {SUBJECTS[group.subject].icon}
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-200">{group.name}</span>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {freq.icon} {freq.label} • {group.nextSessionTime} • {group.location}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-400">
                        {group.sessions.length} sessions
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                icon={<CheckCircle2 className="w-5 h-5" />}
                label="Sessions Attended"
                value={stats.attendedSessions.toString()}
                unit={`of ${stats.totalSessions}`}
                color="text-emerald-400"
                bgColor="bg-emerald-500/10"
                borderColor="border-emerald-500/30"
                progress={
                  stats.totalSessions > 0 ? (stats.attendedSessions / stats.totalSessions) * 100 : 0
                }
              />
              <KPICard
                icon={<Zap className="w-5 h-5" />}
                label="Study Hours"
                value={stats.studyHours.toFixed(1)}
                unit="total"
                color="text-cyan-400"
                bgColor="bg-cyan-500/10"
                borderColor="border-cyan-500/30"
              />
              <KPICard
                icon={<Users className="w-5 h-5" />}
                label="Peer Connections"
                value={stats.peerConnections.toString()}
                unit="students"
                color="text-purple-400"
                bgColor="bg-purple-500/10"
                borderColor="border-purple-500/30"
              />
              <KPICard
                icon={<Award className="w-5 h-5" />}
                label="Avg Group Rating"
                value={
                  myGroups.length > 0
                    ? (myGroups.reduce((s, g) => s + g.avgRating, 0) / myGroups.length).toFixed(1)
                    : "0"
                }
                unit="stars"
                color="text-amber-400"
                bgColor="bg-amber-500/10"
                borderColor="border-amber-500/30"
              />
            </div>

            {/* Subject Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Groups by Subject
                </h3>
              </div>
              <SubjectBreakdownChart subjectBreakdown={stats.subjectBreakdown} />
            </div>

            {/* Attendance Rate per Group */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Attendance by Group
                </h3>
              </div>
              <div className="space-y-3">
                {myGroups.map((group) => (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span>{SUBJECTS[group.subject].icon}</span> {group.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {group.attendanceRate}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          group.attendanceRate >= 90
                            ? "bg-emerald-500"
                            : group.attendanceRate >= 75
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${group.attendanceRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources Overview */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Shared Resources
                </h3>
                <span className="text-[10px] font-mono text-slate-500">
                  ({resources.length} total)
                </span>
              </div>
              <div className="space-y-2">
                {resources.slice(0, 6).map((res) => {
                  const group = groups.find((g) => g.id === res.groupId);
                  const typeIcons: Record<string, string> = {
                    notes: "📝",
                    flashcards: "🃏",
                    "practice-problems": "✏️",
                    video: "🎬",
                    document: "📄",
                    code: "💻",
                  };
                  return (
                    <div
                      key={res.id}
                      className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-3 py-2.5 border border-slate-800/40"
                    >
                      <span className="text-lg">{typeIcons[res.type] || "📄"}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-200 truncate block">
                          {res.title}
                        </span>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mt-0.5">
                          <span>{group?.name || "Unknown"}</span>
                          <span>•</span>
                          <span>{res.uploadedBy}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="w-2.5 h-2.5" /> {res.downloads}
                          </span>
                        </div>
                      </div>
                      <button className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Group Detail Modal */}
      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          onClose={() => setSelectedGroupId(null)}
          onJoin={joinGroup}
          onLeave={leaveGroup}
          onSendMessage={sendMessage}
          onRate={rateGroup}
        />
      )}

      {/* Create Group Modal */}
      {showCreateForm && (
        <CreateGroupModal onClose={() => setShowCreateForm(false)} onCreate={createGroup} />
      )}
    </div>
  );
}

// ─── Create Group Modal ──────────────────────────────────────────────────────

function CreateGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (group: Partial<StudyGroup>) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<StudySubject>("cs");
  const [course, setCourse] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);
  const [frequency, setFrequency] = useState<
    "daily" | "weekly" | "biweekly" | "monthly" | "flexible"
  >("weekly");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      subject,
      course: course.trim(),
      courseCode: courseCode.trim(),
      maxMembers,
      meetingFrequency: frequency,
      location: location.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      nextSession: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      nextSessionTime: "18:00",
      campusBuilding: location.trim() || "TBD",
      size: maxMembers <= 5 ? "small" : maxMembers <= 12 ? "medium" : "large",
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Create Study Group
            </h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g., Calculus II Study Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              Description
            </label>
            <textarea
              placeholder="Describe what your group will study and how you'll meet..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as StudySubject)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
              >
                {(
                  Object.entries(SUBJECTS) as [StudySubject, (typeof SUBJECTS)[StudySubject]][]
                ).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Max Members
              </label>
              <input
                type="number"
                min={2}
                max={25}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Course Name
              </label>
              <input
                type="text"
                placeholder="e.g., Calculus II"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Course Code
              </label>
              <input
                type="text"
                placeholder="e.g., MATH 202"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Meeting Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
              >
                {(
                  Object.entries(FREQUENCY_MAP) as [
                    typeof frequency,
                    { label: string; icon: string },
                  ][]
                ).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g., Library Room 204"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., calculus, problem-solving, exams"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-indigo-500/20"
          >
            Create Study Group
          </button>
        </div>
      </div>
    </div>
  );
}
