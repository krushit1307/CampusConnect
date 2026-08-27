import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  Trash2,
  RefreshCw,
  BarChart3,
  LayoutGrid,
} from "lucide-react";
import { PromoVideoUploader } from "@/components/PromoVideoUploader";
import { ClubManageSkeleton } from "@/components/DashboardWidgetSkeleton";
import { RosterExport } from "@/components/RosterExport";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { ClubMembersTable } from "@/components/Clubs/ClubMembersTable";
import { LeadershipBackgroundCheckModal } from "@/components/Clubs/LeadershipBackgroundCheckModal";
import { requiresLeadershipBackgroundCheck } from "@/lib/clubLeadershipBackgroundCheck";
import { ClubSocialLinksEditor } from "@/components/Clubs/ClubSocialLinksEditor";
import { ClubHierarchyManager } from "@/components/Clubs/ClubHierarchyManager";
import { ClubColorPicker } from "@/components/Clubs/ClubColorPicker";
import { isValidHexColor } from "@/lib/clubTheming";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import ClubAnalyticsDashboard from "@/components/clubs/ClubAnalyticsDashboard";
import PermissionsGrid from "@/components/Clubs/PermissionsGrid";
import ClubRenewalWizard from "@/components/ClubRenewalWizard"; // <-- NEW IMPORT FOR OUR WIZARD
import { WidgetConfigEditor } from "@/components/widgets/WidgetConfigEditor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import ClubAdminWarningBanner from "@/components/ClubAdminWarningBanner";

// ⚠️ Adjust if your Supabase Storage bucket for club banners has a different name
const BUCKET_NAME = "club-banners";

function legacyRoleToLevel(role: unknown): number {
  switch (role) {
    case "admin":
    case "owner":
      return 100;
    case "organizer":
      return 40;
    case "member":
    case "alumni":
      return 10;
    default:
      return 0;
  }
}

export default function ClubManageRoute() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<
    | "settings"
    | "members"
    | "permissions"
    | "events"
    | "constitution"
    | "trash"
    | "analytics"
    | "widgets"
  >("settings");

  // Mock constitution versions for demo
  const oldConstitution =
    "# Club Bylaws\n\n1. Be respectful to everyone.\n2. Meetings are on Tuesdays.";
  const newConstitution =
    "# Club Bylaws\n\n1. Be respectful to all members.\n2. Meetings are on Wednesdays at 5 PM.\n3. Have fun!";

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
  const [promoVideoUrl, setPromoVideoUrl] = useState("");
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [serverClub, setServerClub] = useState<Club | null>(null);
  const [backgroundCheckRequest, setBackgroundCheckRequest] = useState<{
    memberId: string;
    roleId: string;
  } | null>(null);

  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeySecret, setNewKeySecret] = useState("");

  const { data: apiKeys = [], refetch: refetchApiKeys } = useQuery({
    queryKey: ["club_api_keys", club?.id],
    queryFn: async () => {
      if (!club?.id) return [];
      const { data, error } = await supabase
        .from("club_api_keys")
        .select("id, name, prefix, created_at, last_used_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!club?.id && activeTab === "developer",
  });

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      if (!club?.id || !newKeyName.trim()) return;

      const rawSecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const prefixHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const prefix = `cc_${prefixHex}`;
      const fullKey = `${prefix}.${rawSecret}`;

      const { data: keyId, error } = await supabase.rpc("create_club_api_key", {
        p_club_id: club.id,
        p_name: newKeyName,
        p_raw_key: rawSecret,
        p_prefix: prefix,
        p_expires_at: null,
      });

      if (error) throw error;
      setNewKeySecret(fullKey);
      refetchApiKeys();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate API Key");
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase.from("club_api_keys").delete().eq("id", keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("API key revoked successfully!");
      refetchApiKeys();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to revoke API Key");
    },
  });
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: googleIntegration, refetch: refetchGoogleIntegration } = useQuery({
    queryKey: ["google_sheets_integration", club?.id],
    queryFn: async () => {
      if (!club?.id) return null;
      const { data, error } = await supabase
        .from("google_sheets_integrations")
        .select("id, updated_at")
        .eq("club_id", club.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!club?.id,
  });

  const unlinkGoogleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("google_sheets_integrations")
        .delete()
        .eq("club_id", club.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google account unlinked successfully!");
      refetchGoogleIntegration();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to unlink Google account");
    },
  });

  const handleLinkGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-client-id";
    const redirectUri = `${window.location.origin}/api/google/callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${encodeURIComponent(
      "https://www.googleapis.com/auth/spreadsheets",
    )}&access_type=offline&prompt=consent&state=${club.id}`;
    window.location.href = authUrl;
  };

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
          id, name, slug, status, risk_level, description, banner_url, logo_url, visibility, github_repo_url, social_links, social_links_order, promo_video_url, version, widgets_config,
          club_roles (id, title, permissions_level),
          club_members (id, role, role_id, status, user_id, joined_at, can_edit_events, can_manage_finance, can_remove_members, can_post_news, can_manage_permissions, profiles (full_name, avatar_url, handle)),
          events (id, title, event_date, max_attendees, event_rsvps(id))
        `,
        )
        .eq("slug", slug)
        .single();

      if (error) throw error;

      const currentMember = data.club_members.find(
        (m: { user_id: string; role: string }) => m.user_id === user.id,
      );
      const currentRoleLevel = currentMember?.role_id
        ? data.club_roles.find((r: { id: string }) => r.id === currentMember.role_id)
            ?.permissions_level
        : legacyRoleToLevel(currentMember?.role);

      if (!currentMember || (currentRoleLevel ?? 0) < 100) {
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
      setVisibility(club.visibility || "public");
      setGithubRepoUrl(club.github_repo_url || "");
      const links = (club.social_links || {}) as Record<string, string>;
      setTwitterUrl(links.twitter || "");
      setInstagramUrl(links.instagram || "");
      setWebsiteUrl(links.website || "");
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
          description,
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
          .eq("id", club.id)
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

  const updateMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      updates,
    }: {
      memberId: string;
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("club_members").update(updates).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member updated");
      refetch();
    },
    onError: () => toast.error("Failed to update member"),
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

        <ClubAdminWarningBanner
          clubId={club.id}
          clubSlug={club.slug}
          currentStatus={club.lifecycle_status || "active"}
          warningIssuedAt={club.warning_issued_at}
        />

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
                onClick={() => navigate(`/clubs/${slug}/scheduler`)}
                className="neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all bg-lime text-black hover:-translate-y-1 hover:shadow-lg"
              >
                <Calendar size={18} /> Smart Scheduler
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "analytics"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <BarChart2 size={18} /> Analytics
              </button>
              <button
                onClick={() => setActiveTab("roles")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "roles"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <ShieldCheck size={18} /> Roles
              </button>
              <button
                onClick={() => setActiveTab("meetings")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "meetings"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Gavel size={18} /> Meetings
              </button>
              <button
                onClick={() => setActiveTab("merchandise")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "merchandise"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <ShoppingBag size={18} /> Merchandise
              </button>
              <button
                onClick={() => setActiveTab("funding")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "funding"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <DollarSign size={18} /> Funding Requests
              </button>
              <button
                onClick={() => setActiveTab("developer")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "developer"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <Key size={18} /> API Keys
              </button>
              <button
                onClick={() => setActiveTab("finances")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "finances"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <DollarSign size={18} /> Finances
              </button>
              <button
                onClick={() => setActiveTab("widgets")}
                className={`neu-border flex items-center gap-3 p-4 font-mono text-sm font-bold uppercase transition-all ${
                  activeTab === "widgets"
                    ? "bg-black text-white hover:-translate-y-1"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <LayoutGrid size={18} /> Widgets
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
                    updateClubMutation.mutate();
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div>
                      <label className="font-mono text-sm font-bold uppercase mb-1 block">
                        Website URL
                      </label>
                      <input
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="neu-border w-full p-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-sm font-bold uppercase mb-1 block">
                        Twitter URL
                      </label>
                      <input
                        value={twitterUrl}
                        onChange={(e) => setTwitterUrl(e.target.value)}
                        placeholder="https://twitter.com/username"
                        className="neu-border w-full p-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-sm font-bold uppercase mb-1 block">
                        Instagram URL
                      </label>
                      <input
                        value={instagramUrl}
                        onChange={(e) => setInstagramUrl(e.target.value)}
                        placeholder="https://instagram.com/username"
                        className="neu-border w-full p-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={updateClubMutation.isPending}
                    className="neu-border neu-press w-full bg-lime p-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
                  >
                    {updateClubMutation.isPending ? "Saving..." : "Save Settings"}
                  </button>
                </form>

                {/* Google Sheets Integration */}
                <div className="neu-border bg-white p-6 mt-6 space-y-4">
                  <h3 className="font-display text-xl font-bold uppercase">
                    Google Sheets Integration 📊
                  </h3>
                  <p className="text-xs font-mono text-gray-500">
                    Sync RSVP list data dynamically and in real-time directly to a linked Google
                    Sheet.
                  </p>

                  {googleIntegration ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 border-dashed border-green-500 bg-green-50/50 gap-4">
                      <div>
                        <p className="font-mono text-xs font-bold text-green-700">
                          Connected with Google Sheets ✅
                        </p>
                        <p className="font-mono text-[10px] text-gray-400 mt-1">
                          Linked on {new Date(googleIntegration.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => unlinkGoogleMutation.mutate()}
                        disabled={unlinkGoogleMutation.isPending}
                        className="neu-border bg-red-100 px-3 py-1.5 font-mono text-xs font-bold uppercase text-red-700 hover:bg-red-200 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-2 border-black bg-gray-50 gap-4">
                      <p className="font-mono text-xs text-gray-600">
                        Link your Google Account to enable live real-time sheets syncing for events.
                      </p>
                      <button
                        onClick={handleLinkGoogle}
                        className="neu-border neu-press bg-[#a3e635] text-black px-4 py-2 font-mono text-xs font-bold uppercase"
                      >
                        Link Google Account
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "members" &&
              (() => {
                const rosterMembers = (club?.club_members || []).map(
                  (m: {
                    id: string;
                    role: string;
                    role_id: string | null;
                    status: string;
                    user_id: string;
                    joined_at: string | null;
                    club_roles: { title: string; permissions_level: number }[] | null;
                    profiles: unknown;
                  }) => {
                    const profile = Array.isArray(m.profiles)
                      ? m.profiles[0]
                      : (m.profiles as { full_name: string; handle: string });
                    const dynamicRole = Array.isArray(m.club_roles)
                      ? m.club_roles[0]
                      : m.club_roles;
                    return {
                      id: m.id,
                      full_name: profile?.full_name || null,
                      handle: profile?.handle || null,
                      role: dynamicRole?.title ?? m.role,
                      permissionsLevel: dynamicRole?.permissions_level,
                      role_id: m.role_id,
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
                      members={club.club_members}
                      currentUserId={user?.id}
                      clubRoles={club.club_roles}
                      isMutating={updateMemberMutation.isPending}
                      onApprove={(memberId) =>
                        updateMemberMutation.mutate({ memberId, updates: { status: "approved" } })
                      }
                      onReject={(memberId) =>
                        updateMemberMutation.mutate({ memberId, updates: { status: "rejected" } })
                      }
                      onAssignRole={(memberId, roleId) => {
                        if (requiresLeadershipBackgroundCheck(club.risk_level)) {
                          setBackgroundCheckRequest({ memberId, roleId });
                        } else {
                          updateMemberMutation.mutate({ memberId, updates: { role_id: roleId } });
                        }
                      }}
                    />
                  </div>
                );
              })()}

            {backgroundCheckRequest && (
              <LeadershipBackgroundCheckModal
                clubId={club.id}
                memberId={backgroundCheckRequest.memberId}
                desiredRoleId={backgroundCheckRequest.roleId}
                onClose={() => {
                  setBackgroundCheckRequest(null);
                  refetch();
                }}
              />
            )}

            {activeTab === "roles" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <ClubRolesManager clubId={club.id} clubRoles={club.club_roles || []} />
                <ClubHierarchyManager clubId={club.id} />
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
                        max_attendees: number;
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
            {activeTab === "analytics" && <ClubAnalyticsDashboard clubId={club.id} />}
            {activeTab === "finances" && <ClubBudgetDashboard clubId={club.id} />}
            {activeTab === "meetings" && <QuorumPanel clubId={club.id} />}
            {activeTab === "merchandise" && <ManageMerch clubId={club.id} />}
            {activeTab === "funding" && <FundingRequestBuilder clubId={club.id} />}
            {activeTab === "developer" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <h2 className="font-display text-2xl font-bold">Secure API Key Management</h2>
                  <button
                    onClick={() => {
                      setNewKeySecret("");
                      setNewKeyName("");
                      setIsGenerateDialogOpen(true);
                    }}
                    className="neu-border neu-press bg-[#a3e635] text-black px-4 py-2 font-mono text-xs font-bold uppercase"
                  >
                    Generate New Key
                  </button>
                </div>

                <p className="text-sm font-mono text-gray-600">
                  Allow your developer team or external scripts (like Discord bots) to securely
                  fetch club details and upcoming events. Authenticate request endpoints using
                  Bearer Authorization tokens.
                </p>

                {/* API Keys List */}
                <div className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-black text-white uppercase font-bold border-b-2 border-black">
                      <tr>
                        <th className="p-3">Key Name</th>
                        <th className="p-3">Prefix</th>
                        <th className="p-3">Created At</th>
                        <th className="p-3">Last Used At</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black">
                      {apiKeys.length > 0 ? (
                        apiKeys.map((k: any) => (
                          <tr key={k.id} className="hover:bg-gray-50">
                            <td className="p-3 font-bold">{k.name}</td>
                            <td className="p-3 font-semibold text-gray-600">{k.prefix}...</td>
                            <td className="p-3">{new Date(k.created_at).toLocaleDateString()}</td>
                            <td className="p-3">
                              {k.last_used_at
                                ? new Date(k.last_used_at).toLocaleDateString()
                                : "Never"}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => revokeKeyMutation.mutate(k.id)}
                                className="border border-black bg-red-100 px-2.5 py-1 text-[10px] font-bold uppercase text-red-700 hover:bg-red-200 transition-colors"
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-gray-500 italic">
                            No API Keys generated yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Generate Dialog */}
                <AlertDialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                  <AlertDialogContent className="max-w-md border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display text-lg font-black uppercase">
                        Generate API Key
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-mono text-xs text-gray-600">
                        Give this key a clear name so you can track its usage.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    {newKeySecret ? (
                      <div className="space-y-4 my-2">
                        <div className="border-2 border-dashed border-red-500 bg-red-50 p-3 font-mono text-xs text-red-700 font-bold uppercase">
                          ⚠️ Copy this key now! It will not be shown again.
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={newKeySecret}
                            className="w-full border-2 border-black p-2 font-mono text-xs bg-gray-50"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(newKeySecret);
                              toast.success("API key copied to clipboard!");
                            }}
                            className="neu-border neu-press bg-yellow-200 px-3 py-2 font-mono text-xs font-bold uppercase"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 my-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-xs font-bold uppercase">Key Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Discord Bot Key"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="border-2 border-black p-2 font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <AlertDialogFooter className="mt-4">
                      {newKeySecret ? (
                        <button
                          onClick={() => {
                            setIsGenerateDialogOpen(false);
                            setNewKeySecret("");
                            setNewKeyName("");
                          }}
                          className="neu-border bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase"
                        >
                          Close
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsGenerateDialogOpen(false)}
                            className="border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => generateKeyMutation.mutate()}
                            disabled={generateKeyMutation.isPending || !newKeyName.trim()}
                            className="neu-border neu-press bg-[#a3e635] text-black px-4 py-2 font-mono text-xs font-bold uppercase"
                          >
                            {generateKeyMutation.isPending ? "Generating..." : "Generate"}
                          </button>
                        </>
                      )}
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
            {activeTab === "analytics" && <ClubAnalyticsDashboard clubId={club.id} />}
            {activeTab === "widgets" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                  Homepage Widgets
                </h2>
                <p className="font-mono text-sm text-gray-600">
                  Add interactive widgets to your club's public page — live weather, event
                  countdowns, Spotify playlists and more. Drag to reorder; changes save
                  automatically.
                </p>
                <WidgetConfigEditor
                  clubId={club.id}
                  initialWidgets={(club as { widgets_config?: unknown }).widgets_config}
                />
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
