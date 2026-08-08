import React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useNavigate } from "react-router-dom";

interface MemberContextMenuProps {
  children: React.ReactNode;
  member: {
    id: string;
    fullName: string;
    role: string;
    handle?: string;
  };
  onToggleRole: (memberId: string, currentRole: string) => void;
  onKick: (memberId: string) => void;
}

export function MemberContextMenu({
  children,
  member,
  onToggleRole,
  onKick,
}: MemberContextMenuProps) {
  const navigate = useNavigate();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-52 rounded-md border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-1 z-50 animate-in fade-in zoom-in-95 font-mono text-sm">
          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none focus:bg-gray-100"
            onSelect={() => navigate(`/profile/${member.handle || member.id}`)}
          >
            View Profile
          </ContextMenu.Item>

          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none focus:bg-gray-100"
            onSelect={() => onToggleRole(member.id, member.role)}
          >
            {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
          </ContextMenu.Item>

          <ContextMenu.Separator className="my-1 h-px bg-black/20" />

          <ContextMenu.Item
            className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-red-600 outline-none focus:bg-red-50 font-bold"
            onSelect={() => {
              if (confirm(`Remove ${member.fullName || "this member"} from the club?`)) {
                onKick(member.id);
              }
            }}
          >
            Kick Member
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
