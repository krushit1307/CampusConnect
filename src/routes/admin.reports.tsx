import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";

interface Profile {
  full_name: string | null;
  handle: string | null;
}

interface Report {
  id: string;
  reporter_id: string;
  target_type: "post" | "comment" | "club" | "event";
  target_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  note: string | null;
  created_at: string;
  profiles: Profile | Profile[] | null;
}

const ReportTargetDetails = ({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) => {
  const supabase = createClient();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      try {
        if (targetType === "post") {
          const { data } = await supabase
            .from("posts")
            .select("content")
            .eq("id", targetId)
            .single();
          if (active) setContent(data?.content || "Post not found or deleted");
        } else if (targetType === "comment") {
          const { data } = await supabase
            .from("comments")
            .select("content")
            .eq("id", targetId)
            .single();
          if (active) setContent(data?.content || "Comment not found or deleted");
        } else if (targetType === "club") {
          const { data } = await supabase.from("clubs").select("name").eq("id", targetId).single();
          if (active) setContent(data ? `Club: ${data.name}` : "Club not found or deleted");
        } else if (targetType === "event") {
          const { data } = await supabase
            .from("events")
            .select("title")
            .eq("id", targetId)
            .single();
          if (active) setContent(data ? `Event: ${data.title}` : "Event not found or deleted");
        } else {
          if (active) setContent(`Target ID: ${targetId}`);
        }
      } catch {
        if (active) setContent("Error loading details");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchDetails();
    return () => {
      active = false;
    };
  }, [targetType, targetId, supabase]);

  if (loading) return <span className="text-gray-400 font-mono text-xs">Loading target...</span>;
  return (
    <div className="mt-2 bg-gray-100 p-3 text-xs font-mono border-l-2 border-black max-w-full overflow-hidden break-words text-black">
      {content}
    </div>
  );
};

export default function AdminReportsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<unknown | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "resolved" | "dismissed">("all");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) {
            setAuthChecked(true);
          }
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
        if (active) {
          setAuthChecked(true);
        }
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  const {
    data: reports = [],
    isLoading: isReportsLoading,
    refetch,
  } = useQuery<Report[]>({
    queryKey: ["admin_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select(
          `
          id, reporter_id, target_type, target_id, reason, status, details, note, created_at,
          profiles:reporter_id (full_name, handle)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
    enabled: authChecked && role === "system_admin",
  });

  const handleUpdateStatus = async (reportId: string, status: "resolved" | "dismissed") => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({
          status,
          note: note.trim() || null,
        })
        .eq("id", reportId);

      if (error) throw error;

      toast.success(`Report marked as ${status}.`);
      setNote("");
      setActioningId(null);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update report status.");
    }
  };

  if (authChecked && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authChecked && role !== "system_admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6 min-h-screen">
          <div className="neu-border mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-red-500" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-black uppercase font-display">
              Admin access required
            </h1>
            <p className="mt-2 font-mono text-sm text-gray-700">
              Only system administrators can access this moderation queue.
            </p>
          </div>
        </section>
      </SiteShell>
    );
  }

  const filteredReports = reports.filter((r) => {
    if (activeTab === "all") return true;
    return r.status === activeTab;
  });

  return (
    <SiteShell>
      <div className="bg-cream min-h-screen">
        <header className="border-b-2 border-black bg-white px-4 py-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-black">
              Moderation Reports Queue
            </h1>
            <p className="font-mono text-sm text-gray-600 mt-2">
              Review flagged posts, comments, clubs, and events.
            </p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-wrap gap-2 mb-6 border-b-2 border-black pb-4">
            {(["all", "pending", "resolved", "dismissed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === tab ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                {tab} ({reports.filter((r) => tab === "all" || r.status === tab).length})
              </button>
            ))}
          </div>

          {isReportsLoading && (
            <div className="text-center font-mono text-sm py-12 text-black">
              Loading reports queue...
            </div>
          )}

          {!isReportsLoading && filteredReports.length === 0 && (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-500">
              No reports found in this section.
            </div>
          )}

          <div className="space-y-4">
            {filteredReports.map((report) => {
              const profile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles;
              return (
                <div key={report.id} className="neu-border bg-white p-6 space-y-4 text-black">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black pb-2">
                    <div>
                      <span className="neu-border bg-indigo-100 text-indigo-900 px-2 py-1 font-mono text-[10px] font-bold uppercase">
                        {report.target_type}
                      </span>
                      <span className="font-mono text-xs text-gray-500 ml-3">
                        Reported by: {profile?.full_name || "Anonymous"} (@{profile?.handle || ""})
                      </span>
                    </div>
                    <span className="font-mono text-xs text-gray-500">
                      {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-mono text-xs font-bold text-gray-500 uppercase">Reason</p>
                      <p className="font-bold text-red-600 mt-1">{report.reason}</p>

                      {report.details && (
                        <>
                          <p className="font-mono text-xs font-bold text-gray-500 uppercase mt-3">
                            Reporter Notes
                          </p>
                          <p className="text-sm font-mono mt-1 text-gray-800 bg-red-50/50 p-2 border border-red-200">
                            {report.details}
                          </p>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-gray-500 uppercase">
                        Reported Content Content
                      </p>
                      <ReportTargetDetails
                        targetType={report.target_type}
                        targetId={report.target_id}
                      />
                    </div>
                  </div>

                  {report.note && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 font-mono text-xs">
                      <span className="font-bold">Moderator Note:</span> {report.note}
                    </div>
                  )}

                  {report.status === "pending" ? (
                    <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                      {actioningId === report.id ? (
                        <div className="space-y-2">
                          <label className="font-mono text-xs font-bold uppercase block text-black">
                            Add Moderator Note (Optional)
                          </label>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add a resolution note or action taken..."
                            className="neu-border w-full p-2 font-mono text-sm min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(report.id, "resolved")}
                              className="neu-border bg-lime text-black px-3 py-1.5 font-mono text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-green-400"
                            >
                              <CheckCircle size={14} /> Mark Resolved
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(report.id, "dismissed")}
                              className="neu-border bg-red-300 text-black px-3 py-1.5 font-mono text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-red-400"
                            >
                              <XCircle size={14} /> Dismiss Report
                            </button>
                            <button
                              onClick={() => {
                                setActioningId(null);
                                setNote("");
                              }}
                              className="neu-border bg-white text-black px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-cream"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActioningId(report.id)}
                          className="neu-border self-start bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream hover:text-black"
                        >
                          Take Action
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-500 uppercase">
                        Status:{" "}
                        <span
                          className={`font-bold ${
                            report.status === "resolved" ? "text-green-600" : "text-gray-600"
                          }`}
                        >
                          {report.status}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
