import { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Check, Clock3, ShieldAlert, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import {
  formatSubmissionDate,
  mergeClubSubmitters,
  type ClubApprovalStatus,
  type PendingClubRegistration,
} from "@/lib/clubModeration";

interface ProfileRole {
  role: string | null;
}

export default function PendingClubsAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clubs, setClubs] = useState<PendingClubRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadPendingClubs = useCallback(async () => {
    const { data: clubRows, error: clubError } = await supabase
      .from("clubs")
      .select("id, name, slug, description, created_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (clubError) throw new Error(clubError.message);

    const creatorIds = Array.from(
      new Set((clubRows || []).map((club) => club.created_by).filter(Boolean)),
    ) as string[];

    let profiles: { id: string; full_name: string | null }[] = [];
    if (creatorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);

      if (profileError) throw new Error(profileError.message);
      profiles = profileRows || [];
    }

    setClubs(mergeClubSubmitters(clubRows || [], profiles));
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!active) return;
        setUser(currentUser);

        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single<ProfileRole>();

        if (profileError) throw new Error(profileError.message);
        if (!active) return;

        setRole(profile.role);
        if (profile.role === "system_admin") {
          await loadPendingClubs();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load club registrations.");
      } finally {
        if (active) {
          setLoading(false);
          setAuthChecked(true);
        }
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [loadPendingClubs, supabase]);

  const moderateClub = async (clubId: string, status: Exclude<ClubApprovalStatus, "pending">) => {
    setModeratingId(clubId);

    try {
      const { error } = await supabase.rpc("moderate_club_registration", {
        p_club_id: clubId,
        p_status: status,
      });

      if (error) throw new Error(error.message);

      setClubs((current) => current.filter((club) => club.id !== clubId));
      toast.success(status === "approved" ? "Club approved." : "Club rejected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Moderation action failed.");
    } finally {
      setModeratingId(null);
    }
  };

  if (authChecked && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authChecked && role !== "system_admin") {
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
          <h1 className="mt-2 text-4xl font-bold md:text-6xl text-gray-600">
            Pending club registrations
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-gray-800">
            Review newly submitted campus clubs before they appear in the public directory.
          </p>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="neu-border h-72 animate-pulse bg-white p-6" />
              ))}
            </div>
          ) : clubs.length === 0 ? (
            <div className="neu-border neu-shadow mx-auto max-w-2xl bg-white p-10 text-center">
              <Check className="mx-auto h-12 w-12" aria-hidden="true" />
              <h2 className="mt-4 text-3xl font-bold text-black">Queue cleared</h2>
              <p className="mt-3 font-mono text-sm text-gray-700">
                There are no pending club registrations to review.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {clubs.map((club) => {
                const isBusy = moderatingId === club.id;

                return (
                  <article
                    key={club.id}
                    className="neu-border neu-shadow flex flex-col bg-white p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase text-gray-600">
                          /clubs/{club.slug}
                        </p>
                        <h2 className="mt-1 text-2xl font-bold">{club.name}</h2>
                      </div>
                      <span className="neu-border inline-flex items-center gap-1 bg-lavender px-3 py-1 font-mono text-xs font-bold uppercase">
                        <Clock3 className="h-3.5 w-3.5" /> Pending
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-2 border-y-2 border-black py-4 font-mono text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="font-bold uppercase text-black">Submitted by</dt>
                        <dd className="text-right">{club.submitterName}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-bold uppercase">Submitted</dt>
                        <dd className="text-right">{formatSubmissionDate(club.created_at)}</dd>
                      </div>
                    </dl>

                    <div className="markdown-content mt-5 line-clamp-6 min-h-24 font-mono text-sm leading-6 text-gray-700">
                      <ReactMarkdown>
                        {club.description || "No description was provided."}
                      </ReactMarkdown>
                    </div>

                    <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (window.confirm(`Reject ${club.name}?`)) {
                            void moderateClub(club.id, "rejected");
                          }
                        }}
                        className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-white px-5 py-3 font-mono text-xs font-bold uppercase disabled:cursor-wait disabled:opacity-50"
                      >
                        <X className="h-4 w-4 text-black" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void moderateClub(club.id, "approved")}
                        className="neu-border neu-press inline-flex items-center justify-center gap-2 bg-lime px-5 py-3 font-mono text-xs font-bold uppercase disabled:cursor-wait disabled:opacity-50 text-gray-600"
                      >
                        <Check className="h-4 w-4 text-gray-600" />{" "}
                        {isBusy ? "Updating..." : "Approve"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
