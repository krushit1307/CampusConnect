import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Check, Clock3, ShieldAlert, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import {
  formatSubmissionDate,
  mergeClubSubmitters,
  type ClubApprovalStatus,
} from "@/lib/clubModeration";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";

interface ProfileRole {
  role: string | null;
}

export default function PendingClubsAdmin() {
  const [supabase] = useState(() => createClient());
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      return currentUser;
    },
  });

  const { data: role, isLoading: isRoleLoading } = useQuery({
    queryKey: ["user_role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single<ProfileRole>();

      if (error) throw new Error(error.message);
      return profile.role;
    },
    enabled: !!user?.id,
  });

  const isSystemAdmin = role === "system_admin";

  const {
    data: clubs = [],
    isLoading: isClubsLoading,
    isError,
  } = useQuery({
    queryKey: ["pending_clubs"],
    queryFn: async () => {
      const { data: clubRows, error: clubError } = await supabase
        .from("clubs")
        .select("id, name, slug, description, created_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (clubError) throw new Error(clubError.message);

      const creatorIds = Array.from(
        new Set((clubRows || []).map((club) => club.created_by).filter(Boolean)),
      ) as string[];

      let profiles: { id: string; first_name: string | null; last_name: string | null }[] = [];
      if (creatorIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", creatorIds);

        if (profileError) throw new Error(profileError.message);
        profiles = profileRows || [];
      }

      return mergeClubSubmitters(clubRows || [], profiles);
    },
    enabled: isSystemAdmin,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({
      clubId,
      status,
    }: {
      clubId: string;
      status: Exclude<ClubApprovalStatus, "pending">;
    }) => {
      setModeratingId(clubId);
      const { error } = await supabase.rpc("moderate_club_registration", {
        p_club_id: clubId,
        p_status: status,
      });

      if (error) throw new Error(error.message);
      return { clubId, status };
    },
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({ queryKey: ["pending_clubs"] });
      toast.success(status === "approved" ? "Club approved." : "Club rejected.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Moderation action failed.");
    },
    onSettled: () => {
      setModeratingId(null);
    },
  });

  const moderateClub = (clubId: string, status: Exclude<ClubApprovalStatus, "pending">) => {
    moderateMutation.mutate({ clubId, status });
  };

  const loading = isUserLoading || isRoleLoading || (isSystemAdmin && isClubsLoading);

  if (!isUserLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isUserLoading && !isRoleLoading && role !== "system_admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="neu-border neu-shadow mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-black">Admin access required</h1>
            <p className="mt-3 font-mono text-sm leading-6 text-gray-700">
              Only system administrators can review club registrations.
            </p>
            <Link
              to="/clubs"
              className="neu-border neu-press mt-6 inline-block bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream"
            >
              Return to clubs
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow font-bold text-black">System administration</p>
          <h1 className="mt-2 text-4xl font-black text-black">Pending club registrations</h1>
          <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-gray-800">
            Review proposed student organizations. Approving a club makes it public and grants its
            creator organizer permissions.
          </p>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="neu-border neu-shadow bg-white p-8 text-center font-mono text-sm text-gray-600">
              Loading pending registrations...
            </div>
          ) : isError ? (
            <div className="neu-border bg-peach p-8 text-center font-mono text-sm text-black">
              Failed to load pending registrations.
            </div>
          ) : clubs.length === 0 ? (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-600">
              No registrations are waiting for approval.
            </div>
          ) : (
            <div className="space-y-6">
              {clubs.map((club) => (
                <article key={club.id} className="neu-border neu-shadow bg-white p-6 md:p-8">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="neu-border inline-flex items-center gap-1.5 bg-lime px-2.5 py-1 font-mono text-xs font-bold uppercase text-black">
                          <Clock3 className="h-3.5 w-3.5" /> Pending review
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-500">
                          {formatSubmissionDate(club.created_at)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-bold text-black">{club.name}</h2>
                      <p className="font-mono text-xs text-gray-600">
                        Requested by: {club.submitterName}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => moderateClub(club.id, "approved")}
                        disabled={moderatingId === club.id}
                        className="neu-border neu-press inline-flex items-center gap-2 bg-black px-4 py-2.5 font-mono text-xs font-bold uppercase text-cream transition-colors hover:bg-lime hover:text-black disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateClub(club.id, "rejected")}
                        disabled={moderatingId === club.id}
                        className="neu-border neu-press inline-flex items-center gap-2 bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-peach disabled:opacity-50 cursor-pointer"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t-2 border-dashed border-black/20 pt-6">
                    <h3 className="font-mono text-xs font-bold uppercase text-gray-500">
                      Description
                    </h3>
                    <div className="prose prose-sm max-w-none font-mono text-sm leading-relaxed text-black mt-2">
                      <ReactMarkdown>
                        {club.description || "_No description provided._"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
