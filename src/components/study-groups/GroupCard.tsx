import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, Clock, MapPin, Calendar, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PRIVACY_META, type StudyGroup } from "@/types/studyGroups";

interface GroupCardProps {
  group: StudyGroup;
  onSelect: (group: StudyGroup) => void;
}

export function GroupCard({ group, onSelect }: GroupCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const privacyMeta = PRIVACY_META[group.privacy];

  const nextSessionLabel = useMemo(() => {
    if (!group.next_session_at) return null;
    const diff = new Date(group.next_session_at).getTime() - Date.now();
    if (diff < 0) return null;
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "Starting soon";
    if (hours < 24) return `In ${hours}h`;
    return `In ${Math.floor(hours / 24)}d`;
  }, [group.next_session_at]);

  return (
    <motion.article
      whileHover={{ y: -3, scale: 1.01 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(group)}
      className={cn(
        "rounded-xl border-2 bg-white p-5 cursor-pointer transition-all duration-200",
        isHovered ? "border-indigo-300 shadow-lg" : "border-gray-200 shadow-sm",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(group);
      }}
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="secondary" className={cn("text-[10px] font-bold", privacyMeta.bgClass)}>
          {privacyMeta.icon} {privacyMeta.label}
        </Badge>
        {group.course_code && (
          <Badge variant="outline" className="text-[10px] font-mono font-bold">
            {group.course_code}
          </Badge>
        )}
        {group.is_member && (
          <Badge variant="default" className="text-[10px] bg-indigo-600">
            Joined
          </Badge>
        )}
      </div>

      {/* Name */}
      <h3 className="text-base font-bold text-gray-900 line-clamp-1 mb-1">{group.name}</h3>
      {group.course_name && <p className="text-xs text-gray-500 mb-2">{group.course_name}</p>}

      {/* Description */}
      {group.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
          {group.description}
        </p>
      )}

      {/* Tags */}
      {group.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {group.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
            >
              #{tag}
            </span>
          ))}
          {group.tags.length > 4 && (
            <span className="text-[10px] text-gray-400">+{group.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {group.member_count}
            {group.max_members ? `/${group.max_members}` : ""}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {group.resource_count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {nextSessionLabel && (
            <span className="flex items-center gap-1 text-indigo-600 font-semibold">
              <Calendar className="h-3.5 w-3.5" />
              {nextSessionLabel}
            </span>
          )}
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", isHovered && "translate-x-0.5")}
          />
        </div>
      </div>
    </motion.article>
  );
}
