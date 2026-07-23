import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { Settings, Users, Calendar, ShieldCheck, XCircle, CheckCircle } from "lucide-react";
import { ClubManageSkeleton } from "@/components/DashboardWidgetSkeleton";

export default function ClubManageRoute() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "members" | "events">("settings");

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

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
          id, name, slug, description, banner_url, logo_url, visibility,
          club_members (id, role, status, user_id, profiles (full_name, avatar_url, handle)),
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
      setVisibility(club.visibility || "public");
    }
  }, [club]);

  const updateClubMutation = useMutation({
    mutationFn: async () => {
      if (!club) throw new Error("Club not found");
      const { error } = await supabase
        .from("clubs")
        .update({ name, description, banner_url: bannerUrl, logo_url: logoUrl, visibility })
        .eq("id", club.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Club settings updated");
      refetch();
    },
    onError: () => toast.error("Failed to update settings"),
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
                        Banner URL
                      </label>
                      <input
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        className="neu-border w-full p-2 font-mono text-sm"
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

            {activeTab === "members" && (
              <div className="neu-border bg-white p-6 space-y-6">
                <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2">
                  Manage Members
                </h2>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {club.club_members.map(
                    (m: {
                      id: string;
                      role: string;
                      status: string;
                      user_id: string;
                      profiles: unknown;
                    }) => {
                      const profile = Array.isArray(m.profiles)
                        ? m.profiles[0]
                        : (m.profiles as { full_name: string; handle: string; avatar_url: string });
                      return (
                        <div
                          key={m.id}
                          className="neu-border bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <p className="font-bold font-mono">
                              {profile?.full_name || "Unknown User"}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              Role: {m.role} | Status: {m.status}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {m.status === "pending" && (
                              <>
                                <button
                                  onClick={() =>
                                    updateMemberMutation.mutate({
                                      memberId: m.id,
                                      updates: { status: "approved" },
                                    })
                                  }
                                  className="neu-border bg-green-300 p-2 text-xs font-bold uppercase hover:bg-green-400"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() =>
                                    updateMemberMutation.mutate({
                                      memberId: m.id,
                                      updates: { status: "rejected" },
                                    })
                                  }
                                  className="neu-border bg-red-300 p-2 text-xs font-bold uppercase hover:bg-red-400"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            {m.status === "approved" && m.user_id !== user?.id && (
                              <button
                                onClick={() =>
                                  updateMemberMutation.mutate({
                                    memberId: m.id,
                                    updates: { role: m.role === "admin" ? "member" : "admin" },
                                  })
                                }
                                className="neu-border bg-blue-200 p-2 text-xs font-bold uppercase hover:bg-blue-300"
                                title="Toggle Role"
                              >
                                <ShieldCheck size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
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
                          className="neu-border p-4 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div>
                            <p className="font-bold font-display text-lg">{e.title}</p>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              RSVPs: {e.event_rsvps?.length || 0} / {e.max_attendees || "∞"}
                            </p>
                          </div>
                          <button
                            onClick={() => navigate(`/events/${e.id}`)}
                            className="neu-border neu-press bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform"
                          >
                            View Event
                          </button>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SiteShell>
  );
}
