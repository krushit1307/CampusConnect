"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

export interface AvatarGroupUser {
  name: string;
  avatarUrl?: string | null;
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Users to display. The first `max` are rendered as overlapping avatars. */
  users: AvatarGroupUser[];
  /** Maximum number of avatars rendered before aggregation into the +N bubble. */
  max?: number;
  /** Diameter of each avatar in pixels. */
  size?: number;
  /** Negative margin (px) applied between stacked avatars to create the overlap. */
  overlap?: number;
  /** Solid border color applied to every avatar so they stand out from the stack. */
  borderColor?: string;
  /** When true, renders the trailing +N bubble if `users.length > max`. */
  showRemaining?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  {
    users,
    max = 4,
    size = 40,
    overlap = 12,
    borderColor = "#ffffff",
    showRemaining = true,
    className,
    style,
    ...props
  },
  ref,
) {
  const visibleUsers = users.slice(0, max);
  const remaining = users.length - max;
  const hasRemaining = showRemaining && remaining > 0;

  return (
    <div ref={ref} className={cn("flex items-center", className)} style={style} {...props}>
      {visibleUsers.map((user, index) => (
        <Avatar
          key={`${user.name}-${index}`}
          className="rounded-full"
          style={{
            // Overlap each avatar except the first so the stack hugs the start.
            marginLeft: index === 0 ? undefined : -overlap,
            // Reverse z-index so the first avatar is painted on top.
            zIndex: users.length - index,
            width: size,
            height: size,
            border: `2px solid ${borderColor}`,
          }}
        >
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback className="text-xs font-medium">{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      ))}
      {hasRemaining ? (
        <div
          role="img"
          aria-label={`${remaining} more people`}
          style={{
            marginLeft: -overlap,
            zIndex: users.length - max,
            width: size,
            height: size,
            border: `2px solid ${borderColor}`,
          }}
          className="flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
        >
          +{remaining}
        </div>
      ) : null}
    </div>
  );
});
AvatarGroup.displayName = "AvatarGroup";
