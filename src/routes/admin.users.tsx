import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle, XCircle, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  handle: string | null;
  role: string | null;
  is_banned: boolean;
}

interface GraphQLResponse {
  profiles: Profile[];
  totalProfiles: number;
}

interface MutationResponse {
  suspendUsers: {
    id: string;
    is_banned: boolean;
  }[];
}

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message || "GraphQL Error");
  }
  return json.data as T;
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const [user, setUser] = useState<unknown>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Grid states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(10);
  const [page, setPage] = useState(0);
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
      const variables = {
        limit,
        offset: page * limit,
        sortBy,
        sortOrder,
      };

      const data = await graphqlRequest<GraphQLResponse>(query, variables);
      setProfiles(data.profiles);
      setTotal(data.totalProfiles);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load users from GraphQL.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [authChecked, role, page, limit, sortBy, sortOrder]);

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
    setPage(0);
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
      await graphqlRequest<MutationResponse>(mutation, { ids: idsToSuspend });
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
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
                  <tbody>
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
                      profiles.map((profile) => {
                        const isSelected = selectedIds.has(profile.id);
                        const isSuspended =
                          profile.is_banned || optimisticSuspendedIds.has(profile.id);

                        return (
                          <tr
                            key={profile.id}
                            className={`border-b-2 border-black font-semibold text-sm hover:bg-cream/20 transition-colors ${
                              isSelected ? "bg-lime/5" : ""
                            }`}
                          >
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

            {/* Pagination Controls */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t-2 border-black pt-6 text-sm font-bold">
              <div>
                Showing {total === 0 ? 0 : page * limit + 1} to{" "}
                {Math.min(total, (page + 1) * limit)} of {total} users
              </div>
              <div className="flex gap-4">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className={`neu-border px-4 py-1.5 uppercase transition-all rounded-none cursor-pointer ${
                    page > 0
                      ? "bg-white hover:-translate-y-0.5 active:translate-y-0 text-black border-black"
                      : "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed"
                  }`}
                >
                  Previous
                </button>
                <button
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className={`neu-border px-4 py-1.5 uppercase transition-all rounded-none cursor-pointer ${
                    (page + 1) * limit < total
                      ? "bg-white hover:-translate-y-0.5 active:translate-y-0 text-black border-black"
                      : "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
