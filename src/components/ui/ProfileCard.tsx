import React from "react";
import { cn } from "@/lib/utils";

export interface ProfileCardProps {
  /** User display name. */
  name: string;
  /** Short bio / tagline. */
  bio?: string;
  /** Role badge (e.g. "Admin", "Organizer", "Student"). */
  role?: string;
  /** URL to the user's avatar image. */
  avatarUrl?: string;
  /** Department or affiliation line. */
  department?: string;
  /** Optional additional className for the root container. */
  className?: string;
}

/**
 * Compact profile card designed to be rendered inside a RichTooltip.
 *
 * Displays:
 * - Avatar with fallback initials
 * - Name, role badge, bio, and department
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  bio,
  role,
  avatarUrl,
  department,
  className,
}) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("flex items-start gap-3 min-w-[200px]", className)}>
      {/* Avatar */}
      <div className="shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-10 w-10 rounded-full border border-slate-600 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-800 font-mono text-xs font-bold text-slate-300">
            {initials}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white truncate">{name}</span>
          {role && (
            <span className="shrink-0 px-1.5 py-0.5 bg-blue-600/30 border border-blue-500/40 rounded text-[10px] font-bold uppercase text-blue-300">
              {role}
            </span>
          )}
        </div>

        {department && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{department}</p>}

        {bio && (
          <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">{bio}</p>
        )}
      </div>
    </div>
  );
};
