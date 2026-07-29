import { useState, useEffect, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Trash2, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
}

interface SoftDeletedItem {
  id: string;
  content: string;
  created_at: string;
  deleted_at: string;
  profiles: Profile | Profile[] | null;
}

export default function AdminRestorePage() {
  const supabase = createClient();
  const [user, setUser] = useState<unknown | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");

  // Authenticate user
  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!currentUser) {
          if (active) setAuthChecked(true);
          return;
        }
        if (active) setUser(currentUser);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
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

  // Fetch soft-deleted posts
  const {
    data: deletedPosts = [],
    isLoading: isPostsLoading,
    refetch: refetchPosts,
  } = useQuery<SoftDeletedItem[]>({
    queryKey: ["deleted_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id, content, created_at, deleted_at,
          profiles:author_id (id, first_name, last_name, handle)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SoftDeletedItem[];
    },
    enabled: authChecked && role === "system_admin",
  });

  // Fetch soft-deleted comments
  const {
    data: deletedComments = [],
    isLoading: isCommentsLoading,
    refetch: refetchComments,
  } = useQuery<SoftDeletedItem[]>({
    queryKey: ["deleted_comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select(`
          id, content, created_at, deleted_at,
          profiles:author_id (id, first_name, last_name, handle)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SoftDeletedItem[];
    },
    enabled: authChecked && role === "system_admin",
  });

  // Restore post mutation
  const restorePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: null })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post restored successfully!");
      refetchPosts();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to restore post.");
    },
  });

  // Restore comment mutation
  const restoreCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .update({ deleted_at: null })
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment restored successfully!");
      refetchComments();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to restore comment.");
    },
  });

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
              Only system administrators can access the trash restoration panel.
            </p>
          </div>
        </section>
      </SiteShell>
    );
  }

  const activeItems = activeTab === "posts" ? deletedPosts : deletedComments;
  const isLoading = activeTab === "posts" ? isPostsLoading : isCommentsLoading;

  const handleRestore = (id: string) => {
    if (activeTab === "posts") {
      restorePostMutation.mutate(id);
    } else {
      restoreCommentMutation.mutate(id);
    }
  };

  return (
    <SiteShell>
      <div className="bg-cream min-h-screen">
        {/* Header */}
        <header className="border-b-2 border-black bg-white px-4 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-black flex items-center gap-3">
                <Trash2 className="h-9 w-9 text-red-500" />
                Trash & Restore Panel
              </h1>
              <p className="font-mono text-sm text-gray-600 mt-2">
                Inspect and restore soft-deleted discussions and comments.
              </p>
            </div>
            <Link
              to="/admin/reports"
              className="neu-border inline-flex items-center gap-2 bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-50 transition-all text-black"
            >
              <ArrowLeft size={14} />
              Back to Moderation
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b-2 border-black pb-4">
            <button
              onClick={() => setActiveTab("posts")}
              className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                activeTab === "posts" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              Deleted Posts ({deletedPosts.length})
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                activeTab === "comments" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              Deleted Comments ({deletedComments.length})
            </button>
          </div>

          {/* List Loader / Empty */}
          {isLoading && (
            <div className="text-center font-mono text-sm py-12 text-black">
              Loading soft-deleted items...
            </div>
          )}

          {!isLoading && activeItems.length === 0 && (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-500">
              No soft-deleted {activeTab} found in the trash.
            </div>
          )}

          {/* Trash Items Queue */}
          <div className="space-y-4">
            {activeItems.map((item) => {
              const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
              const authorName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Unknown User";
              const authorHandle = profile?.handle ? `@${profile.handle}` : "";

              return (
                <div key={item.id} className="neu-border bg-white p-6 space-y-4 text-black shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000]">
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black pb-2">
                    <div>
                      <span className="font-mono text-xs text-gray-500">
                        Author: <span className="font-bold text-black">{authorName}</span> {authorHandle}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-gray-500">
                      Deleted on: {new Date(item.deleted_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div>
                    <p className="font-mono text-xs font-bold text-gray-400 uppercase">Content Preview</p>
                    <div className="bg-gray-50 p-4 font-mono text-sm border-l-2 border-black mt-2 text-black whitespace-pre-wrap max-w-full overflow-hidden break-words">
                      {item.content}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => handleRestore(item.id)}
                      disabled={restorePostMutation.isPending || restoreCommentMutation.isPending}
                      className="neu-border bg-lime hover:bg-lime/90 px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-black shadow-[2px_2px_0_0_#000]"
                    >
                      <RefreshCw size={14} className={restorePostMutation.isPending || restoreCommentMutation.isPending ? "animate-spin" : ""} />
                      Restore Item
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
