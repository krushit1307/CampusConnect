import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { CheckCircle, ShieldCheck, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberIdentity } from "./MemberIdentity";
import { MemberContextMenu } from "./MemberContextMenu";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClubMemberRow {
  id: string;
  role: string;
  status: string;
  user_id: string;
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

  if (member.status === "approved" && member.user_id !== currentUserId) {
    return (
      <button
        onClick={() => onToggleRole(member.id, member.role)}
        disabled={isMutating}
        className="neu-border bg-blue-200 p-2 text-xs font-bold uppercase hover:bg-blue-300 disabled:opacity-50"
        title="Toggle Role"
        aria-label={`Toggle role for ${member.fullName}`}
      >
        <ShieldCheck size={16} />
      </button>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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

  // NOTE on scaling: this table is fully client-side — all members are
  // fetched up front and paginated/filtered in the browser. That's fine up
  // to a few thousand rows. If rosters grow past ~5,000 members, the initial
  // Supabase payload itself becomes the bottleneck (not just DOM rendering),
  // so client-side pagination alone won't save us at that point.
  //
  // To swap to server-side pagination later:
  //   1. Pass `manualPagination: true` and `pageCount` to useReactTable below.
  //   2. Replace the `data` memo with a paginated query keyed on
  //      [page index, page size, globalFilter] (e.g. Supabase `.range()` +
  //      `.ilike()` for search), and refetch when `pagination`/`globalFilter`
  //      state changes via `onPaginationChange` / a debounced search effect.
  //   3. Drop `getFilteredRowModel` / `getPaginationRowModel` since the
  //      server now owns filtering and slicing.
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).toLowerCase().trim();
      if (!query) return true;
      const member = row.original as ClubMemberRow;
      return (
        member.fullName.toLowerCase().includes(query) ||
        member.handle.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query) ||
        member.status.toLowerCase().includes(query)
      );
    },
    initialState: {
      pagination: { pageSize: DEFAULT_PAGE_SIZE, pageIndex: 0 },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalFiltered = table.getFilteredRowModel().rows.length;

  const rangeStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min(totalFiltered, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-4">
      <SearchInput
        value={globalFilter}
        onChange={(value) => {
          setGlobalFilter(value);
          table.setPageIndex(0);
        }}
        placeholder="Search members by name, handle, role, or status..."
      />

      {rows.length === 0 ? (
        <EmptyState
          illustration="no-results"
          title="No members match your search."
          description={globalFilter ? undefined : "This club doesn't have any members yet."}
        />
      ) : (
        <>
          {/* Desktop / tablet: table view */}
          <div className="neu-border hidden overflow-x-auto md:block">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="p-3 text-left text-xs font-bold uppercase">Member</th>
                  <th className="p-3 text-left text-xs font-bold uppercase">Role</th>
                  <th className="p-3 text-left text-xs font-bold uppercase">Status</th>
                  <th className="p-3 text-right text-xs font-bold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const member = row.original;
                  return (
                    <MemberContextMenu
                      key={member.id}
                      member={member}
                      onToggleRole={onToggleRole}
                      onKick={onReject}
                    >
                      <tr className="border-b border-black/10 last:border-b-0 hover:bg-gray-50">
                        <td className="p-3">
                          <MemberIdentity member={member} />
                        </td>
                        <td className="p-3">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="p-3">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end">
                            <MemberActions
                              member={member}
                              currentUserId={currentUserId}
                              isMutating={isMutating}
                              onApprove={onApprove}
                              onReject={onReject}
                              onToggleRole={onToggleRole}
                            />
                          </div>
                        </td>
                      </tr>
                    </MemberContextMenu>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked card view */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const member = row.original;
              return (
                <MemberContextMenu
                  key={member.id}
                  member={member}
                  onToggleRole={onToggleRole}
                  onKick={onReject}
                >
                  <div className="neu-border bg-gray-50 p-4 space-y-3">
                    <MemberIdentity member={member} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-2">
                        <RoleBadge role={member.role} />
                        <StatusBadge status={member.status} />
                      </div>
                      <MemberActions
                        member={member}
                        currentUserId={currentUserId}
                        isMutating={isMutating}
                        onApprove={onApprove}
                        onReject={onReject}
                        onToggleRole={onToggleRole}
                      />
                    </div>
                  </div>
                </MemberContextMenu>
              );
            })}
          </div>

          {/* Pagination controls */}
          <div className="neu-border flex flex-col gap-3 bg-white p-3 font-mono text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="text-gray-500">
              Showing {rangeStart}–{rangeEnd} of {totalFiltered} member
              {totalFiltered === 1 ? "" : "s"}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 uppercase font-bold">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                  }}
                  className="neu-border bg-white px-2 py-1 font-mono text-xs"
                >
                  {ROWS_PER_PAGE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="neu-border bg-white px-3 py-1.5 font-bold uppercase hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="whitespace-nowrap font-bold uppercase">
                  Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="neu-border bg-white px-3 py-1.5 font-bold uppercase hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Columns are structural only — all real rendering happens via the row
// objects above (table/card markup), but @tanstack/react-table still wants
// column defs to drive its row model machinery.
const columns: ColumnDef<ClubMemberRow>[] = [
  { accessorKey: "fullName", header: "Member" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "status", header: "Status" },
];
