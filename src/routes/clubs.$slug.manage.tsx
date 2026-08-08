import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  Settings,
  Users,
  Calendar,
  ShieldCheck,
  XCircle,
  CheckCircle,
  Download,
} from "lucide-react";
import { PromoVideoUploader } from "@/components/PromoVideoUploader";
import { ClubManageSkeleton } from "@/components/DashboardWidgetSkeleton";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { ClubMembersTable } from "@/components/Clubs/ClubMembersTable";
import { ClubSocialLinksEditor } from "@/components/Clubs/ClubSocialLinksEditor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

// ⚠️ Adjust if your Supabase Storage bucket for club banners has a different name
const BUCKET_NAME = "club-banners";

interface ServerClub {
  name: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  promo_video_url: string | null;
  visibility: string | null;
  github_repo_url: string | null;
  social_links: Record<string, string> | null;
  version: number;
}

export default function ClubManageRoute() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "settings" | "members" | "permissions" | "events" | "trash"
  >("settings");

  // Fetch Trash Events
  const {
    data: trashEvents = [],
    isLoading: isTrashLoading,
    refetch: refetchTrash,
  } = useQuery({
    queryKey: ["club_trash_events", slug],
    queryFn: async () => {
      if (!user || !club) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, deleted_at, max_attendees")
        .eq("club_id", club.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: activeTab === "trash" && !!club,
  });

  const restoreEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: null })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event restored successfully!");
      refetchTrash();
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to restore event");
    },
  });

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialLinksOrder, setSocialLinksOrder] = useState<string[]>([
    "website",
    "twitter",
    "instagram",
  ]);
  const [promoVideoUrl, setPromoVideoUrl] = useState("");
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [serverClub, setServerClub] = useState<ServerClub | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: club,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["club_manage", slug],
    queryFn: async () => {
      if (!user) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("clubs")
        .select(
          `
          id, name, slug, description, banner_url, logo_url, visibility, github_repo_url, social_links, social_links_order, promo_video_url, version,
          club_members (id, role, status, user_id, joined_at, can_edit_events, can_manage_finance, can_remove_members, can_post_news, can_manage_permissions, profiles (full_name, avatar_url, handle)),
          events (id, title, event_date, max_attendees, event_rsvps(id))
        `,
        )
        .eq("slug", slug)
        .single();

      if (error) throw error;

      const currentMember = data.club_members.find(
        (m: { user_id: string; role: string }) => m.user_id === user.id,
      );
      if (!currentMember || currentMember.role !== "admin") {
        throw new Error("Unauthorized");
      }

      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (club) {
      setName(club.name);
      setDescription(club.description || "");
      setBannerUrl(club.banner_url || "");
      setLogoUrl(club.logo_url || "");
      setVisibility((club.visibility as "public" | "private") || "public");
      setGithubRepoUrl(club.github_repo_url || "");
      const links = (club.social_links || {}) as Record<string, string>;
      setTwitterUrl(links.twitter || "");
      setInstagramUrl(links.instagram || "");
      setWebsiteUrl(links.website || "");
      const savedOrder = (club.social_links_order || []) as string[];
      setSocialLinksOrder(savedOrder.length > 0 ? savedOrder : ["website", "twitter", "instagram"]);
      setPromoVideoUrl(club.promo_video_url || "");
    }
  }, [club]);

  const getDifferences = () => {
    if (!serverClub) return [];
    const diffs: { field: string; draft: string; server: string }[] = [];

    if (name !== serverClub.name) {
      diffs.push({ field: "Club Name", draft: name, server: serverClub.name });
    }
    if (description !== (serverClub.description || "")) {
      diffs.push({
        field: "Description",
        draft: description,
        server: serverClub.description || "",
      });
    }
    if (bannerUrl !== (serverClub.banner_url || "")) {
      diffs.push({ field: "Banner URL", draft: bannerUrl, server: serverClub.banner_url || "" });
    }
    if (logoUrl !== (serverClub.logo_url || "")) {
      diffs.push({ field: "Logo URL", draft: logoUrl, server: serverClub.logo_url || "" });
    }
    if (promoVideoUrl !== (serverClub.promo_video_url || "")) {
      diffs.push({
        field: "Promo Video URL",
        draft: promoVideoUrl,
        server: serverClub.promo_video_url || "",
      });
    }
    if (visibility !== (serverClub.visibility || "public")) {
      diffs.push({
        field: "Visibility",
        draft: visibility,
        server: serverClub.visibility || "public",
      });
    }
    if (githubRepoUrl !== (serverClub.github_repo_url || "")) {
      diffs.push({
        field: "GitHub Repo URL",
        draft: githubRepoUrl,
        server: serverClub.github_repo_url || "",
      });
    }

    const serverLinks = (serverClub.social_links || {}) as Record<string, string>;
    if (twitterUrl !== (serverLinks.twitter || "")) {
      diffs.push({ field: "Twitter Link", draft: twitterUrl, server: serverLinks.twitter || "" });
    }
    if (instagramUrl !== (serverLinks.instagram || "")) {
      diffs.push({
        field: "Instagram Link",
        draft: instagramUrl,
        server: serverLinks.instagram || "",
      });
    }
    if (websiteUrl !== (serverLinks.website || "")) {
      diffs.push({ field: "Website Link", draft: websiteUrl, server: serverLinks.website || "" });
    }

    return diffs;
  };

  const updateClubMutation = useMutation<void, Error, boolean | undefined>({
    mutationFn: async (force?: boolean) => {
      if (!club) throw new Error("Club not found");

      const githubRepo = githubRepoUrl.trim() || null;
      if (githubRepo && !githubRepo.startsWith("https://github.com/")) {
        throw new Error("GitHub repository URL must start with https://github.com/");
      }

      const socialLinks: Record<string, string> = {};
      if (twitterUrl.trim()) socialLinks.twitter = twitterUrl.trim();
      if (instagramUrl.trim()) socialLinks.instagram = instagramUrl.trim();
      if (websiteUrl.trim()) socialLinks.website = websiteUrl.trim();

      const urlPattern = /^https?:\/\//i;
      for (const [key, val] of Object.entries(socialLinks)) {
        if (!urlPattern.test(val)) {
          throw new Error(
            `${key.charAt(0).toUpperCase() + key.slice(1)} URL must start with http:// or https://`,
          );
        }
      }

      let targetVersion = club.version || 1;
      if (force) {
        const { data: latest, error: fetchErr } = await supabase
          .from("clubs")
          .select("version")
          .eq("id", club.id)
          .single();
        if (fetchErr) throw fetchErr;
        targetVersion = latest.version;
      }

      const { data, error } = await supabase
        .from("clubs")
        .update({
          name,
          description: sanitizeHtml(description),
          banner_url: bannerUrl,
          logo_url: logoUrl,
          promo_video_url: promoVideoUrl || null,
          visibility,
          github_repo_url: githubRepo,
          social_links: socialLinks,
          version: targetVersion + 1,
        })
        .eq("id", club.id)
        .eq("version", targetVersion)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("CONCURRENT_EDIT_CONFLICT");
      }
    },
    onSuccess: () => {
      toast.success("Club settings updated");
      setIsConflictDialogOpen(false);
      refetch();
    },
    onError: async (err: Error) => {
      if (err.message === "CONCURRENT_EDIT_CONFLICT") {
        toast.error("Conflict detected: Another user updated this profile.");
        const { data: latest } = await supabase
          .from("clubs")
          .select(
            "name, description, banner_url, logo_url, promo_video_url, visibility, github_repo_url, social_links, version",
          )
          .eq("id", club!.id)
          .single();
        if (latest) {
          setServerClub(latest);
          setIsConflictDialogOpen(true);
        }
      } else {
        toast.error(err.message || "Failed to update settings");
      }
    },
  });

  const [optimisticRoles, setOptimisticRoles] = useState<Record<string, string>>({});

  const updateMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      updates,
    }: {
      memberId: string;
      updates: Record<string, unknown>;
    }) => {
      if (updates.role && typeof updates.role === "string") {
        setOptimisticRoles((prev) => ({ ...prev, [memberId]: updates.role as string }));
      }
      const { error } = await supabase
        .from("club_members")
        .update(updates as TablesUpdate<"club_members">)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member role updated successfully");
      refetch();
    },
    onError: (_err, variables) => {
      if (variables?.memberId) {
        setOptimisticRoles((prev) => {
          const next = { ...prev };
          delete next[variables.memberId];
          return next;
        });
      }
      toast.error("Role update failed. Reverted to previous role.");
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (updates: PermissionUpdate[]) => {
      // Batch update all permissions in a single transaction
      const { error } = await supabase.rpc("batch_update_permissions", {
        updates: updates.map((u) => ({
          member_id: u.memberId,
          can_edit_events: u.permissions.can_edit_events,
          can_manage_finance: u.permissions.can_manage_finance,
          can_remove_members: u.permissions.can_remove_members,
          can_post_news: u.permissions.can_post_news,
          can_manage_permissions: u.permissions.can_manage_permissions,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissions updated successfully");
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to update permissions: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <SiteShell>
        <ClubManageSkeleton />
      </SiteShell>
    );
  }

  if (!club) {
    return (
      <SiteShell>
        <div className="p-8 text-center font-mono text-red-500">
          Unauthorized or Club not found.
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="bg-cream min-h-screen">
        <header className="border-b-2 border-black bg-white px-4 py-8">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-black">
                Manage: {club.name}
              </h1>
              <button
                onClick={() => navigate(`/clubs/${club.slug}`)}
                className="font-mono text-sm text-blue-600 hover:underline mt-2"
              >
                &larr; Back to Club Page
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab("settings")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "settings"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Settings size={18} /> Settings
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "members"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Users size={18} /> Members
              </button>
              <button
                onClick={() => setActiveTab("permissions")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "permissions"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <ShieldCheck size={18} /> Permissions
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "events"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Calendar size={18} /> Events
              </button>
              <button
                onClick={() => setActiveTab("trash")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "trash"
                    ? "bg-red-500 text-white hover:-translate-y-1"
                    : "bg-white text-red-500 hover:bg-red-50"
                }`}
              >
                <Trash2 size={18} /> Trash
              </button>
            </nav>
          </aside>

          <main className="flex-1">
            {activeTab === "settings" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                  Club Settings
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateClubMutation.mutate(undefined as any);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="font-mono text-sm font-bold uppercase mb-1 block">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="neu-border w-full p-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-sm font-bold uppercase mb-1 block">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="neu-border w-full p-2 font-mono text-sm min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-sm font-bold uppercase mb-1 block">
                        Banner Image
                      </label>
                      <ImageCropUpload
                        aspect={16 / 9}
                        bucket={BUCKET_NAME}
                        value={bannerUrl || undefined}
                        onUploaded={(url) => setBannerUrl(url)}
                        hint="JPEG, PNG, WEBP — max 5MB · 16:9 crop"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-sm font-bold uppercase mb-1 block">
                        Logo URL
                      </label>
                      <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="neu-border w-full p-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="pt-2 pb-2">
                    <PromoVideoUploader
                      clubId={club.id}
                      initialVideoUrl={promoVideoUrl}
                      onUploadComplete={(url) => setPromoVideoUrl(url || "")}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-sm font-bold uppercase mb-1 block">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                      className="neu-border w-full p-2 font-mono text-sm"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-sm font-bold uppercase mb-1 block">
                      GitHub Repo URL
                    </label>
                    <input
                      value={githubRepoUrl}
                      onChange={(e) => setGithubRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      className="neu-border w-full p-2 font-mono text-sm"
                    />
                  </div>
                  <ClubSocialLinksEditor
                    clubId={club.id}
                    order={socialLinksOrder}
                    values={{ website: websiteUrl, twitter: twitterUrl, instagram: instagramUrl }}
                    onValueChange={(platform, value) => {
                      if (platform === "website") setWebsiteUrl(value);
                      if (platform === "twitter") setTwitterUrl(value);
                      if (platform === "instagram") setInstagramUrl(value);
                    }}
                    onOrderChange={setSocialLinksOrder}
                  />{" "}
                  <button
                    type="submit"
                    disabled={updateClubMutation.isPending}
                    className="neu-border neu-press w-full bg-lime p-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
                  >
                    {updateClubMutation.isPending ? "Saving..." : "Save Settings"}
                  </button>
                </form>
              </div>
            )}

            {activeTab === "members" &&
              (() => {
                const rosterMembers = (club?.club_members || []).map(
                  (m: {
                    id: string;
                    role: string;
                    status: string;
                    user_id: string;
                    joined_at: string | null;
                    profiles: unknown;
                  }) => {
                    const profile = Array.isArray(m.profiles)
                      ? m.profiles[0]
                      : (m.profiles as { full_name: string; handle: string });
                    return {
                      id: m.id,
                      full_name: profile?.full_name || null,
                      handle: profile?.handle || null,
                      role: m.role,
                      status: m.status,
                      joined_at: m.joined_at || null,
                    };
                  },
                );

                return (
                  <div className="neu-border bg-white p-6 space-y-6">
                    <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                      Manage Members
                    </h2>
                    <ClubMembersTable
                      members={(club.club_members || []).map(
                        (m: {
                          id: string;
                          role: string;
                          status: string;
                          user_id: string;
                          joined_at: string | null;
                          profiles: unknown;
                        }) => ({
                          ...m,
                          role: optimisticRoles[m.id] || m.role,
                        }),
                      )}
                      currentUserId={user?.id}
                      isMutating={updateMemberMutation.isPending}
                      onApprove={(memberId) =>
                        updateMemberMutation.mutate({ memberId, updates: { status: "approved" } })
                      }
                      onReject={(memberId) =>
                        updateMemberMutation.mutate({ memberId, updates: { status: "rejected" } })
                      }
                      onToggleRole={(memberId, targetRole) =>
                        updateMemberMutation.mutate({
                          memberId,
                          updates: { role: targetRole },
                        })
                      }
                    />
                  </div>
                );
              })()}

            {activeTab === "permissions" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                  Role Permissions
                </h2>
                <PermissionsGrid
                  members={(club.club_members || []).map((m: any) => {
                    const profile = Array.isArray(m.profiles)
                      ? m.profiles[0]
                      : (m.profiles as {
                          full_name: string;
                          handle: string;
                          avatar_url: string | null;
                        });
                    return {
                      id: m.id,
                      user_id: m.user_id,
                      fullName: profile?.full_name || "Unknown User",
                      handle: profile?.handle || "",
                      avatarUrl: profile?.avatar_url || null,
                      role: m.role,
                      status: m.status,
                      can_edit_events: m.can_edit_events || false,
                      can_manage_finance: m.can_manage_finance || false,
                      can_remove_members: m.can_remove_members || false,
                      can_post_news: m.can_post_news || false,
                      can_manage_permissions: m.can_manage_permissions || false,
                    };
                  })}
                  currentUserId={user?.id || ""}
                  onSave={(updates) => updatePermissionsMutation.mutateAsync(updates)}
                  isSaving={updatePermissionsMutation.isPending}
                />
              </div>
            )}

            {activeTab === "events" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                  Club Events
                </h2>
                <div className="space-y-4">
                  {club.events.length === 0 ? (
                    <p className="font-mono text-sm text-gray-500">No events found.</p>
                  ) : (
                    club.events.map(
                      (e: {
                        id: string;
                        title: string;
                        max_attendees: number | null;
                        event_rsvps: unknown[];
                      }) => (
                        <div
                          key={e.id}
                          className="neu-border p-4 flex items-center justify-between hover:bg-gray-50 flex-wrap gap-4"
                        >
                          <div>
                            <p className="font-bold font-display text-lg">{e.title}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              RSVPs: {e.event_rsvps?.length || 0} / {e.max_attendees || "∞"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/events/${e.id}/dashboard`)}
                              className="neu-border neu-press bg-lime text-black px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform"
                            >
                              Insights
                            </button>
                            <button
                              onClick={() => navigate(`/events/${e.id}`)}
                              className="neu-border neu-press bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform"
                            >
                              View Event
                            </button>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            )}

            {activeTab === "trash" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2 text-red-600 flex items-center gap-2">
                  <Trash2 size={24} /> Deleted Events Trash
                </h2>
                <p className="font-mono text-sm text-gray-600">
                  Events deleted within the last 30 days can be restored here. After 30 days, they
                  are permanently deleted.
                </p>
                <div className="space-y-4">
                  {isTrashLoading ? (
                    <p className="font-mono text-sm text-gray-500">Loading trash...</p>
                  ) : trashEvents.length === 0 ? (
                    <p className="font-mono text-sm text-gray-500">Trash is empty.</p>
                  ) : (
                    trashEvents.map((e) => (
                      <div
                        key={e.id}
                        className="neu-border border-red-200 p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-red-50 flex-wrap gap-4"
                      >
                        <div>
                          <p className="font-bold font-display text-lg text-red-800">{e.title}</p>
                          <p className="text-xs text-red-500 font-mono mt-1">
                            Deleted on:{" "}
                            {e.deleted_at ? new Date(e.deleted_at).toLocaleString() : "Unknown"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreEventMutation.mutate(e.id)}
                            disabled={restoreEventMutation.isPending}
                            className="neu-border neu-press bg-lime text-black px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform disabled:opacity-50 flex items-center gap-2"
                          >
                            <RefreshCw
                              size={14}
                              className={restoreEventMutation.isPending ? "animate-spin" : ""}
                            />
                            Restore
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
        <AlertDialogContent className="max-w-2xl border-2 border-black bg-white rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold font-mono text-red-600 flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-600 shrink-0" />
              Editing Conflict Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 font-mono text-sm">
              Another administrator has saved changes to this club profile while you were editing.
              Below is a comparison of the conflicting changes:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 overflow-x-auto border-2 border-black">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-2 border-r border-white">Field</th>
                  <th className="p-2 border-r border-white">Your Draft</th>
                  <th className="p-2">Server State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {getDifferences().map((diff, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-2 border-r border-black font-bold bg-gray-100">
                      {diff.field}
                    </td>
                    <td className="p-2 border-r border-black text-red-600 bg-red-50/50 break-all">
                      {diff.draft || <em className="text-gray-400">Empty</em>}
                    </td>
                    <td className="p-2 text-green-700 bg-green-50/50 break-all">
                      {diff.server || <em className="text-gray-400">Empty</em>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AlertDialogFooter className="mt-4 flex gap-3 sm:justify-end">
            <button
              onClick={() => {
                setIsConflictDialogOpen(false);
                refetch();
              }}
              className="px-4 py-2 border-2 border-black font-mono font-bold text-sm bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Discard My Changes
            </button>
            <button
              onClick={() => updateClubMutation.mutate(true)}
              className="px-4 py-2 border-2 border-black font-mono font-bold text-sm bg-red-600 text-white hover:bg-red-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Force Overwrite Server
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SiteShell>
  );
}
