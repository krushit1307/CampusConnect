import { useState, useEffect, useCallback, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Eye from "lucide-react/dist/esm/icons/eye";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/xcircle";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Copy from "lucide-react/dist/esm/icons/copy";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { type ColumnDef } from "@tanstack/react-table";
import { AdminDataGrid } from "@/components/ui/AdminDataGrid";
import { BulkUserImportModal } from "@/components/admin/BulkUserImportModal";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface Profile {
  id: string;
  full_name: string | null;
  handle: string | null;
  role: string | null;
  is_banned: boolean;
}

import { fetchGraphQL, GraphQLPartialError } from "@/lib/graphql-client";
import {
  GetProfilesQuery,
  GetProfilesQueryVariables,
  SuspendUsersMutation,
  SuspendUsersMutationVariables,
} from "@/generated/graphql";

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  return fetchGraphQL<T, Record<string, unknown>>(query, variables);
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const [user, setUser] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Grid states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(10000);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Optimistic UI state
  const [optimisticSuspendedIds, setOptimisticSuspendedIds] = useState<Set<string>>(new Set());

  // Row context-menu (right-click) quick actions
  const { copyToClipboard } = useCopyToClipboard();
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState("member");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Authenticate user
  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setAuthChecked(true);
          return;
        }
        if (active) setUser(user);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile && active) {
          setRole(profile.role);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Load profiles from GraphQL
  const loadProfiles = useCallback(async () => {
    if (!authChecked || role !== "system_admin") return;
    setLoading(true);
    try {
      const query = `
        query GetProfiles($limit: Int!, $offset: Int!) {
          profiles(limit: $limit, offset: $offset) {
            id
            full_name
            handle
            role
            is_banned
          }
          totalProfiles
        }
      `;
      const variables = {
        limit,
        offset: 0,
      };
      const data = await graphqlRequest<GetProfilesQuery>(query, variables);
      setProfiles(data.profiles);
      setTotal(data.totalProfiles);
    } catch (err: unknown) {
      console.error(err);
      // Partial failure: render what we got, warn the user
      if (err instanceof GraphQLPartialError) {
        const partial = err.data as GetProfilesQuery;
        if (partial?.profiles) setProfiles(partial.profiles as Profile[]);
        if (partial?.totalProfiles != null) setTotal(partial.totalProfiles);
        toast.warning("Some user data failed to load. Showing partial results.");
      } else {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load users from GraphQL.";
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [authChecked, role, limit]);
  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // Checkbox row toggle helper
  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Column definitions for AdminDataGrid
  const profileColumns = useMemo<ColumnDef<Profile, unknown>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={profiles.length > 0 && profiles.every((p) => selectedIds.has(p.id))}
            onChange={() => {
              const allSelected = profiles.every((p) => selectedIds.has(p.id));
              setSelectedIds(() => {
                if (allSelected) return new Set<string>();
                return new Set(profiles.map((p) => p.id));
              });
            }}
            className="h-4 w-4 cursor-pointer accent-lime"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.full_name ?? row.original.id}`}
            checked={selectedIds.has(row.original.id)}
            onChange={() => handleToggleSelectRow(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer accent-lime"
          />
        ),
        size: 44,
        enableSorting: false,
        enableColumnFilter: false,
        enableResizing: false,
      },
      {
        accessorKey: "full_name",
        id: "full_name",
        header: "Name",
        cell: ({ getValue }) => <span>{String(getValue() ?? "N/A")}</span>,
        size: 200,
      },
      {
        accessorKey: "handle",
        id: "handle",
        header: "Handle",
        cell: ({ getValue }) => (
          <span className="text-gray-600">@{String(getValue() ?? "N/A")}</span>
        ),
        size: 160,
      },
      {
        accessorKey: "role",
        id: "role",
        header: "Role",
        cell: ({ getValue }) => (
          <span className="bg-gray-200 px-2 py-0.5 border border-black text-[10px] uppercase font-bold">
            {String(getValue() ?? "member")}
          </span>
        ),
        size: 130,
      },
      {
        id: "status",
        accessorFn: (row) =>
          row.is_banned || optimisticSuspendedIds.has(row.id) ? "suspended" : "active",
        header: "Status",
        cell: ({ getValue }) =>
          getValue() === "suspended" ? (
            <span className="bg-peach text-black border border-black px-2 py-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase">
              <XCircle className="h-3 w-3" />
              Suspended
            </span>
          ) : (
            <span className="bg-lime text-black border border-black px-2 py-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase">
              <CheckCircle className="h-3 w-3" />
              Active
            </span>
          ),
        size: 120,
      },
    ],
    [profiles, selectedIds, optimisticSuspendedIds, handleToggleSelectRow],
  );
  // Bulk Suspend action
  const handleBulkSuspend = async () => {
    if (selectedIds.size === 0) return;

    const idsToSuspend = Array.from(selectedIds);
    // Optimistic Update
    setOptimisticSuspendedIds((prev) => {
      const next = new Set(prev);
      idsToSuspend.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());

    try {
      const mutation = `
        mutation SuspendUsers($ids: [ID!]!) {
          suspendUsers(ids: $ids) {
            id
            is_banned
          }
        }
      `;
      const variables: SuspendUsersMutationVariables = { ids: idsToSuspend };
      await graphqlRequest<SuspendUsersMutation>(mutation, variables);
      toast.success(`Successfully suspended ${idsToSuspend.length} users.`);
      void loadProfiles();
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Failed to suspend selected users.";
      toast.error(errorMessage);
      // Rollback optimistic state
      setOptimisticSuspendedIds((prev) => {
        const next = new Set(prev);
        idsToSuspend.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  // Copy ID quick action
  const handleCopyId = useCallback(
    async (profile: Profile) => {
      const didCopy = await copyToClipboard(profile.id);
      if (didCopy) {
        toast.success("User ID copied to clipboard.");
      } else {
        toast.error("Could not copy user ID.");
      }
    },
    [copyToClipboard],
  );
const handleImpersonate = useCallback(async (profile: Profile) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      toast.error("Admin session not found.");
      return;
    }

    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        target_user_id: profile.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to impersonate user.");
    }

    sessionStorage.setItem("impersonation_token", data.token);
    sessionStorage.setItem("impersonated_user", JSON.stringify(data.user));

    window.location.reload();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to impersonate user.");
  }
}, [supabase]);
  // Edit quick action
  const openEditDialog = useCallback((profile: Profile) => {
    setEditingProfile(profile);
    setEditRole(profile.role ?? "member");
  }, []);

  const handleSaveEdit = async () => {
    if (!editingProfile) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: editRole })
        .eq("id", editingProfile.id);
      if (error) throw error;
      toast.success(`Updated ${editingProfile.full_name ?? "user"}'s role to ${editRole}.`);
      setEditingProfile(null);
      void loadProfiles();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update user.";
      toast.error(errorMessage);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete quick action
  const handleConfirmDelete = async () => {
    if (!deletingProfile) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", deletingProfile.id);
      if (error) throw error;
      toast.success(`Deleted ${deletingProfile.full_name ?? "user"}.`);
      setDeletingProfile(null);
      void loadProfiles();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete user.";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (authChecked && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authChecked && role !== "system_admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6 min-h-screen">
          <div className="mx-auto max-w-lg text-center font-mono">
            <div className="inline-flex h-16 w-16 items-center justify-center bg-peach neu-border rounded-none mb-6">
              <ShieldAlert className="h-8 w-8 text-black" />
            </div>
            <h1 className="text-3xl font-bold text-black uppercase">Admin access required</h1>
            <p className="mt-4 text-sm text-gray-700 font-bold uppercase">
              Only system administrators can access user management.
            </p>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="bg-cream min-h-screen px-4 py-12 md:px-8 font-mono text-black">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b-4 border-black pb-8">
            <div>
              <p className="eyebrow font-bold text-gray-600 uppercase text-xs tracking-wider">
                System Administration
              </p>
              <h1 className="text-4xl font-extrabold uppercase mt-1">User Directory</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="neu-border px-4 py-2 text-sm font-bold uppercase transition-all flex items-center gap-2 rounded-none cursor-pointer bg-lime hover:-translate-y-0.5 active:translate-y-0 text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Bulk Import CSV
              </button>
              <button
                onClick={handleBulkSuspend}
                disabled={selectedIds.size === 0}
                className={`neu-border px-4 py-2 text-sm font-bold uppercase transition-all flex items-center gap-2 rounded-none cursor-pointer ${
                  selectedIds.size > 0
                    ? "bg-peach hover:-translate-y-0.5 active:translate-y-0 text-black border-black"
                    : "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                }`}
              >
                <XCircle className="h-4 w-4" />
                Suspend Selected ({selectedIds.size})
              </button>
            </div>
          </div>

          {/* Admin Data Grid */}
          <div className="mt-8 bg-white neu-border p-6 rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-black">
            <AdminDataGrid<Profile>
              tableId="admin-users"
              data={profiles}
              columns={profileColumns}
              isLoading={loading}
              ariaLabel="User directory data grid"
              pinnedColumns={["select", "actions"]}
              exportFilename="campus-users-export"
              renderRowContextMenu={(profile) => (
                <>
<ContextMenuItem
  className="cursor-pointer gap-2 rounded-none focus:bg-lime focus:text-black"
  onSelect={() => void handleImpersonate(profile)}
>
  <Eye className="h-3.5 w-3.5" />
  Impersonate
</ContextMenuItem>                  <ContextMenuItem
                    className="cursor-pointer gap-2 rounded-none focus:bg-lime focus:text-black"
                    onSelect={() => openEditDialog(profile)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Role
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="cursor-pointer gap-2 rounded-none focus:bg-lime focus:text-black"
                    onSelect={() => void handleCopyId(profile)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy ID
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-black/10" />
                  <ContextMenuItem
                    className="cursor-pointer gap-2 rounded-none text-red-600 focus:bg-red-100 focus:text-red-700"
                    onSelect={() => setDeletingProfile(profile)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </ContextMenuItem>
                </>
              )}
            />
            <div className="mt-6 flex items-center border-t-2 border-black pt-6 text-sm font-bold">
              <div>Total: {total} users</div>
            </div>
          </div>
        </div>
      </div>
      <BulkUserImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccessRefresh={() => void loadProfiles()}
      />

      {/* Edit Role dialog (context menu "Edit" action) */}
      <AlertDialog
        open={editingProfile !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProfile(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-none border-2 border-black bg-white p-6 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold uppercase">
              Edit User Role
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-700">
              Change the role for{" "}
              <span className="font-bold">
                {editingProfile?.full_name ?? editingProfile?.handle ?? "this user"}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4">
            <label htmlFor="edit-role-select" className="text-xs font-bold uppercase text-gray-600">
              Role
            </label>
            <select
              id="edit-role-select"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase"
            >
              <option value="member">Member</option>
              <option value="club_admin">Club Admin</option>
              <option value="system_admin">System Admin</option>
            </select>
          </div>
          <AlertDialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <AlertDialogCancel
              disabled={isSavingEdit}
              className="rounded-none border-2 border-black bg-white font-bold uppercase shadow-[2px_2px_0_0_#000]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSavingEdit}
              onClick={(e) => {
                e.preventDefault();
                void handleSaveEdit();
              }}
              className="rounded-none border-2 border-black bg-lime font-bold uppercase text-black shadow-[2px_2px_0_0_#000] hover:bg-lime"
            >
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog (context menu "Delete" action) */}
      <AlertDialog
        open={deletingProfile !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingProfile(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-none border-2 border-black bg-white p-6 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold uppercase text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-700">
              This will permanently delete{" "}
              <span className="font-bold">
                {deletingProfile?.full_name ?? deletingProfile?.handle ?? "this user"}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <AlertDialogCancel
              disabled={isDeleting}
              className="rounded-none border-2 border-black bg-white font-bold uppercase shadow-[2px_2px_0_0_#000]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              className="rounded-none border-2 border-black bg-red-600 font-bold uppercase text-white shadow-[2px_2px_0_0_#000] hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SiteShell>
  );
}
