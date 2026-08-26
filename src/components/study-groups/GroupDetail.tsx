import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  BookOpen,
  Calendar,
  MapPin,
  Plus,
  ExternalLink,
  ArrowRight,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useStudyGroupDetail,
  useGroupMembers,
  useGroupSessions,
  useGroupResources,
  useJoinGroup,
  useLeaveGroup,
  useAddResource,
} from "@/hooks/useStudyGroups";
import { useStudyGroupStore } from "@/store/useStudyGroupStore";
import {
  PRIVACY_META,
  SESSION_STATUS_META,
  RESOURCE_TYPE_META,
  type GroupResource,
} from "@/types/studyGroups";
import { cn } from "@/lib/utils";

interface GroupDetailProps {
  groupId: string | null;
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
  onClose: () => void;
}

export function GroupDetail({
  groupId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onClose,
}: GroupDetailProps) {
  const { data: group, isLoading } = useStudyGroupDetail(groupId);
  const { data: members = [] } = useGroupMembers(groupId);
  const { data: sessions = [] } = useGroupSessions(groupId);
  const { data: resources = [] } = useGroupResources(groupId);
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const addResource = useAddResource();
  const { isSessionFormOpen, setSessionFormOpen } = useStudyGroupStore();

  const [tab, setTab] = useState<"sessions" | "members" | "resources">("sessions");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [showResourceForm, setShowResourceForm] = useState(false);

  if (!groupId) return null;

  const isMember = group?.is_member;
  const upcomingSessions = sessions.filter((s) => s.status === "scheduled");

  const handleJoin = () => {
    if (!currentUserId || !group) return;
    joinGroup.mutate({
      groupId: group.id,
      userId: currentUserId,
      userName: currentUserName,
      userAvatar: currentUserAvatar,
    });
  };

  const handleLeave = () => {
    if (!currentUserId || !group) return;
    if (window.confirm("Leave this group?")) {
      leaveGroup.mutate({ groupId: group.id, userId: currentUserId });
    }
  };

  const handleAddResource = () => {
    if (!resourceTitle.trim() || !currentUserId || !group) return;
    addResource.mutate({
      groupId: group.id,
      title: resourceTitle.trim(),
      url: resourceUrl.trim() || null,
      description: null,
      resourceType: "link",
      userId: currentUserId,
      userName: currentUserName,
    });
    setResourceTitle("");
    setResourceUrl("");
    setShowResourceForm(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              {group && (
                <Badge
                  variant="secondary"
                  className={cn("text-xs", PRIVACY_META[group.privacy].bgClass)}
                >
                  {PRIVACY_META[group.privacy].icon} {PRIVACY_META[group.privacy].label}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-5 py-5">
            {isLoading || !group ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-gray-900">{group.name}</h2>
                  {group.course_code && (
                    <p className="text-sm text-gray-500 mt-1">
                      {group.course_code} — {group.course_name}
                    </p>
                  )}
                </div>

                {group.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{group.description}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {group.member_count} members
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {group.resource_count} resources
                  </span>
                  {group.meeting_location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {group.meeting_location}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {group.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Join / Leave */}
                <div className="flex gap-2">
                  {isMember ? (
                    <Button
                      onClick={handleLeave}
                      variant="outline"
                      className="rounded-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <UserMinus className="h-4 w-4" /> Leave Group
                    </Button>
                  ) : currentUserId ? (
                    <Button
                      onClick={handleJoin}
                      disabled={joinGroup.isPending}
                      className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      {joinGroup.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Join Group
                    </Button>
                  ) : (
                    <p className="text-sm text-gray-400">Log in to join this group.</p>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  {(["sessions", "members", "resources"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        "px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px",
                        tab === t
                          ? "border-indigo-600 text-indigo-700"
                          : "border-transparent text-gray-400 hover:text-gray-600",
                      )}
                    >
                      {t === "sessions" && <Calendar className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t === "members" && <Users className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t === "resources" && <BookOpen className="h-3.5 w-3.5 inline mr-1.5" />}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                      {t === "sessions" && ` (${sessions.length})`}
                      {t === "members" && ` (${members.length})`}
                      {t === "resources" && ` (${resources.length})`}
                    </button>
                  ))}
                </div>

                {/* Sessions tab */}
                {tab === "sessions" && (
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">
                        No sessions scheduled yet.
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <div key={s.id} className="rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-bold text-gray-800">{s.title}</h4>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", SESSION_STATUS_META[s.status].bgClass)}
                            >
                              {SESSION_STATUS_META[s.status].label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(s.starts_at).toLocaleDateString()}{" "}
                            {new Date(s.starts_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {s.location && ` — ${s.location}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Members tab */}
                {tab === "members" && (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-1.5">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 overflow-hidden">
                          {m.user_avatar ? (
                            <img
                              src={m.user_avatar}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            m.user_name.charAt(0)
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-800 flex-1">
                          {m.user_name}
                        </span>
                        {m.role !== "member" && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {m.role}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Resources tab */}
                {tab === "resources" && (
                  <div className="space-y-3">
                    {currentUserId &&
                      isMember &&
                      (showResourceForm ? (
                        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                          <Input
                            placeholder="Resource title"
                            value={resourceTitle}
                            onChange={(e) => setResourceTitle(e.target.value)}
                            className="h-9 text-sm"
                          />
                          <Input
                            placeholder="URL (optional)"
                            value={resourceUrl}
                            onChange={(e) => setResourceUrl(e.target.value)}
                            className="h-9 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleAddResource}
                              disabled={!resourceTitle.trim()}
                              className="rounded-full text-xs"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowResourceForm(false)}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowResourceForm(true)}
                          className="rounded-full text-xs gap-1.5"
                        >
                          <Plus className="h-3 w-3" /> Add Resource
                        </Button>
                      ))}
                    {resources.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">
                        No resources shared yet.
                      </p>
                    ) : (
                      resources.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                        >
                          <span className="text-lg">
                            {RESOURCE_TYPE_META[r.resource_type]?.icon ?? "📎"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-800">{r.title}</h4>
                            <p className="text-[10px] text-gray-400">by {r.uploaded_by_name}</p>
                          </div>
                          {r.url && (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-500 hover:text-indigo-700 shrink-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
