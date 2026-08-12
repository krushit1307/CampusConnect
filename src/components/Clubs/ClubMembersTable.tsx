import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import XCircle from "lucide-react/dist/esm/icons/xcircle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberContextMenu } from "./MemberContextMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/EmptyState";

import { GenerateLeadershipCertButton } from "./GenerateLeadershipCertButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClubMemberRow {
  id: string;
  role: string;
  status: string;
  user_id: string;
  club_id?: string;
  joined_at?: string | null;
  created_at?: string;
  removed_at?: string | null;
  termination_reason?: string | null;
  fullName: string;
  handle: string;
  avatarUrl: string | null;
}

interface RawProfile {
  full_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
}

interface RawClubMember {
  id: string;
  role: string;
  status: string;
  user_id: string;
  club_id?: string;
  joined_at?: string | null;
  created_at?: string;
  removed_at?: string | null;
  termination_reason?: string | null;
  profiles: RawProfile | RawProfile[] | null;
}

interface ClubMembersTableProps {
  members: RawClubMember[];
  currentUserId?: string;
  isMutating?: boolean;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
  onToggleRole: (memberId: string, currentRole: string) => void;
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizeMember(m: RawClubMember): ClubMemberRow {
  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  return {
    id: m.id,
    role: m.role,
    status: m.status,
    user_id: m.user_id,
    club_id: m.club_id,
    joined_at: m.joined_at,
    created_at: m.created_at,
    removed_at: m.removed_at,
    termination_reason: m.termination_reason,
    fullName: profile?.full_name || "Unknown User",
    handle: profile?.handle || "",
    avatarUrl: profile?.avatar_url || null,
  };
}

const statusStyles: Record<string, string> = {
  pending: "bg-peach",
  approved: "bg-lime",
  rejected: "bg-red-300",
};

const roleStyles: Record<string, string> = {
  admin: "bg-sky",
  member: "bg-lavender",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`neu-border inline-block px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none ${
        statusStyles[status] || "bg-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`neu-border inline-block px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none ${
        roleStyles[role] || "bg-gray-200"
      }`}
    >
      {role}
    </span>
  );
}

function MemberIdentity({ member }: { member: ClubMemberRow }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-10 w-10 shrink-0 rounded-full border-2 border-black">
        <AvatarImage
          src={member.avatarUrl || undefined}
          alt={member.fullName}
          className="rounded-full"
        />
        <AvatarFallback className="rounded-full bg-brand-blue-light font-bold text-black">
          {getInitials(member.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-bold font-mono" title={member.fullName}>
          {member.fullName}
        </p>
        {member.handle && (
          <p className="truncate text-xs text-gray-500 font-mono">@{member.handle}</p>
        )}
      </div>
    </div>
  );
}

function MemberActions({
  member,
  currentUserId,
  isMutating,
  onApprove,
  onReject,
  onToggleRole,
}: {
  member: ClubMemberRow;
  currentUserId?: string;
  isMutating?: boolean;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
  onToggleRole: (memberId: string, currentRole: string) => void;
}) {
  if (member.status === "pending") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(member.id)}
          disabled={isMutating}
          className="neu-border bg-green-300 p-2 text-xs font-bold uppercase hover:bg-green-400 disabled:opacity-50"
          aria-label={`Approve ${member.fullName}`}
        >
          <CheckCircle size={16} />
        </button>
        <button
          onClick={() => onReject(member.id)}
          disabled={isMutating}
          className="neu-border bg-red-300 p-2 text-xs font-bold uppercase hover:bg-red-400 disabled:opacity-50"
          aria-label={`Reject ${member.fullName}`}
        >
          <XCircle size={16} />
        </button>
      </div>
    );
  }

  if (member.status === "approved") {
    return (
      <div className="flex items-center gap-2">
        {member.user_id !== currentUserId && (
          <select
            value={member.role}
            disabled={isMutating}
            onChange={(e) => onToggleRole(member.id, e.target.value)}
            className="neu-border bg-white px-2 py-1 font-mono text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
            aria-label={`Change role for ${member.fullName}`}
          >
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        )}
        {member.club_id && (
          <GenerateLeadershipCertButton
            memberId={member.id}
            userId={member.user_id}
            clubId={member.club_id}
            memberName={member.fullName}
            roleTitle={member.role}
            joinedAt={member.joined_at}
            createdAt={member.created_at}
            removedAt={member.removed_at}
            terminationReason={member.termination_reason}
            buttonVariant="compact"
          />
        )}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main component
import { DraggableAdminTable } from "@/components/ui/DraggableAdminTable";

export function ClubMembersTable({
  members,
  currentUserId,
  isMutating,
  onApprove,
  onReject,
  onToggleRole,
}: ClubMembersTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const data = useMemo(() => members.map(normalizeMember), [members]);

  const filteredData = useMemo(() => {
    const query = globalFilter.toLowerCase().trim();
    if (!query) return data;
    return data.filter(
      (m) =>
        m.fullName.toLowerCase().includes(query) ||
        m.handle.toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query) ||
        m.status.toLowerCase().includes(query),
    );
  }, [data, globalFilter]);

  const columns = useMemo<ColumnDef<ClubMemberRow>[]>(
    () => [
      {
        id: "member",
        accessorKey: "fullName",
        header: "Member",
        cell: ({ row }) => <MemberIdentity member={row.original} />,
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <MemberActions
              member={row.original}
              currentUserId={currentUserId}
              isMutating={isMutating}
              onApprove={onApprove}
              onReject={onReject}
              onToggleRole={onToggleRole}
            />
          </div>
        ),
      },
    ],
    [currentUserId, isMutating, onApprove, onReject, onToggleRole],
  );

  return (
    <div className="space-y-4">
      <SearchInput
        value={globalFilter}
        onChange={(value) => setGlobalFilter(value)}
        placeholder="Search members by name, handle, role, or status..."
      />

      {filteredData.length === 0 ? (
        <EmptyState
          illustration="no-results"
          title="No members match your search."
          description={globalFilter ? undefined : "This club doesn't have any members yet."}
        />
      ) : (
        <DraggableAdminTable
          tableId="club_members"
          data={filteredData}
          columns={columns}
          pinnedColumns={["actions"]}
          renderRowContextMenu={(member, children) => (
            <MemberContextMenu
              key={member.id}
              member={member}
              onToggleRole={onToggleRole}
              onKick={onReject}
            >
              {children}
            </MemberContextMenu>
          )}
        />
      )}
    </div>
  );
}
