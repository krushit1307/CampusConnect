import { useState, useEffect, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Navigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { BulkUserImportModal } from "@/components/admin/BulkUserImportModal";

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
  const [sortBy, setSortBy] = useState<string>("full_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Optimistic UI state
  const [optimisticSuspendedIds, setOptimisticSuspendedIds] = useState<Set<string>>(new Set());

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
        query GetProfiles($limit: Int!, $offset: Int!, $sortBy: String!, $sortOrder: String!) {
          profiles(limit: $limit, offset: $offset, sortBy: $sortBy, sortOrder: $sortOrder) {
            id
            full_name
            handle
            role
            is_banned
          }
          totalProfiles
        }
      `;
      const variables: GetProfilesQueryVariables = {
        limit,
        offset: 0,
        sortBy,
        sortOrder,
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
  }, [authChecked, role, limit, sortBy, sortOrder]);
  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // Checkbox interactions
  const handleToggleSelectAll = () => {
    const currentPageIds = profiles.map((p) => p.id);
    const allSelected = currentPageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sorting interaction
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };
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

  const currentPageIds = profiles.map((p) => p.id);
  const allCurrentSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: profiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // estimated row height in px
    overscan: 5, // buffer rows above/below viewport
  });
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

          {/* Grid Container */}
          <div className="mt-8 bg-white neu-border p-6 rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] border-black">
            {loading && profiles.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-lime" />
                <span className="text-sm font-bold uppercase">Loading profiles...</span>
              </div>
            ) : (
              <div ref={parentRef} className="overflow-auto" style={{ height: "600px" }}>
                <table className="w-full text-left border-collapse">
                  {" "}
                  <thead>
                    <tr className="border-b-4 border-black font-bold uppercase text-sm">
                      <th className="py-4 px-3 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allCurrentSelected}
                          onChange={handleToggleSelectAll}
                          className="h-4 w-4 cursor-pointer neu-border accent-lime"
                        />
                      </th>
                      <th
                        onClick={() => handleSort("full_name")}
                        className="py-4 px-4 cursor-pointer hover:bg-cream/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Name
                          {sortBy === "full_name" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            ))}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("handle")}
                        className="py-4 px-4 cursor-pointer hover:bg-cream/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Handle
                          {sortBy === "handle" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            ))}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("role")}
                        className="py-4 px-4 cursor-pointer hover:bg-cream/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Role
                          {sortBy === "role" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            ))}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("is_banned")}
                        className="py-4 px-4 cursor-pointer hover:bg-cream/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {sortBy === "is_banned" &&
                            (sortOrder === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            ))}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
                  >
                    {profiles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-gray-500 font-bold uppercase"
                        >
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const profile = profiles[virtualRow.index];
                        const isSelected = selectedIds.has(profile.id);
                        const isSuspended =
                          profile.is_banned || optimisticSuspendedIds.has(profile.id);

                        return (
                          <tr
                            key={profile.id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              display: "table",
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className={`border-b-2 border-black font-semibold text-sm hover:bg-cream/20 transition-colors ${
                              isSelected ? "bg-lime/5" : ""
                            }`}
                          >
                            {" "}
                            <td className="py-4 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(profile.id)}
                                className="h-4 w-4 cursor-pointer neu-border accent-lime"
                              />
                            </td>
                            <td className="py-4 px-4">{profile.full_name || "N/A"}</td>
                            <td className="py-4 px-4">@{profile.handle || "N/A"}</td>
                            <td className="py-4 px-4 uppercase text-xs">
                              <span className="bg-gray-200 px-2 py-1 border border-black rounded-none">
                                {profile.role || "member"}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs font-bold uppercase">
                              {isSuspended ? (
                                <span className="bg-peach text-black border border-black px-2 py-1 inline-flex items-center gap-1.5 rounded-none">
                                  <XCircle className="h-3.5 w-3.5" />
                                  Suspended
                                </span>
                              ) : (
                                <span className="bg-lime text-black border border-black px-2 py-1 inline-flex items-center gap-1.5 rounded-none">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Active
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {/* Row count summary — pagination replaced by virtual scrolling */}
            <div className="mt-6 flex items-center border-t-2 border-black pt-6 text-sm font-bold">
              <div>Showing all {total} users</div>
            </div>{" "}
          </div>
        </div>
      </div>
      <BulkUserImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccessRefresh={() => void loadProfiles()}
      />
    </SiteShell>
  );
}
