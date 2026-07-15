import * as React from "react";

type MemberRole = "admin" | "organizer" | "member" | "alumni";

interface RoleBadgeProps {
  role: MemberRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  if (!role || role === "member") return null;

  const colorMap: Record<MemberRole, string> = {
    admin: "bg-peach",
    organizer: "bg-lime",
    alumni: "bg-sky",
    member: "bg-white",
  };

  return (
    <span
      className={`neu-border ml-2 inline-block px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-black ${
        colorMap[role] || "bg-white"
      }`}
    >
      {role}
    </span>
  );
}
