import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { ArticleCard } from "@/components/Clubs/ArticleCard";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { useBreadcrumbs } from "@/components/BreadcrumbsContext";

export default function ClubArticlesPage() {
  const { slug = "", lang = "en" } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const { setCustomTrail } = useBreadcrumbs();

  // Get user details
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  // Query Club details by slug to get club ID
  const { data: club, isLoading: isClubLoading } = useQuery({
    queryKey: ["clubBySlug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug, created_by")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(slug),
  });

  // Query membership to check role
  const { data: membership } = useQuery({
    queryKey: ["clubMembership", club?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_members")
        .select("role, status")
        .eq("club_id", club!.id)
        .eq("user_id", user!.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: Boolean(club?.id && user?.id),
  });

  // Query all articles for this club
  const {
    data: articles = [],
    isLoading: isArticlesLoading,
    refetch,
  } = useQuery({
    queryKey: ["clubArticles", club?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          `
          id, club_id, title, content, read_time_minutes, created_at,
          profiles (first_name, last_name, avatar_url)
        `,
        )
        .eq("club_id", club?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(club?.id),
  });

  // Set breadcrumbs trail override
  useEffect(() => {
    if (!club) {
      const skeleton = (
        <span className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700 inline-block align-middle" />
      );
      setCustomTrail([
        { label: "Home", path: `/${lang}` },
        { label: "Clubs", path: `/${lang}/clubs` },
        { label: skeleton },
        { label: "News" },
      ]);
      return;
    }

    setCustomTrail([
      { label: "Home", path: `/${lang}` },
      { label: "Clubs", path: `/${lang}/clubs` },
      { label: club.name, path: `/${lang}/clubs/${club.slug}` },
      { label: "News" },
    ]);

    return () => setCustomTrail(null);
  }, [club, lang, setCustomTrail]);

  // Mutation to create an article
  const createArticleMutation = useMutation({
    mutationFn: async () => {
      if (!user || !club) throw new Error("Must be logged in");
      const { data, error } = await supabase
        .from("articles")
        .insert({
          club_id: club.id,
          author_id: user.id,
          title: newTitle,
          slug: newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "article",
          content: newContent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Article published successfully!");
      setShowCreateModal(false);
      setNewTitle("");
      setNewContent("");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish article");
    },
  });

  const isClubAdmin = club?.created_by === user?.id || membership?.role === "admin";

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      return void toast.error("Title and Content are required");
    }
    createArticleMutation.mutate();
  };

  if (isClubLoading) {
    return (
      <SiteShell>
        <div className="flex h-64 w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link
              to={`/clubs/${slug}`}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-gray-500 hover:underline"
            >
              <ArrowLeft size={12} /> Back to {club?.name || "Club"}
            </Link>
            <h1 className="font-display text-3xl font-black uppercase text-indigo-900 tracking-tight">
              Club News & Articles
            </h1>
          </div>

          {isClubAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="neu-border neu-press inline-flex items-center gap-2 bg-lime px-4 py-2.5 font-mono text-xs font-bold uppercase text-black"
            >
              <Plus size={16} /> Publish Article
            </button>
          )}
        </div>

        {isArticlesLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="neu-border bg-white p-5 flex flex-col gap-4 animate-pulse">
                <div className="h-4 bg-gray-200 w-1/3 rounded" />
                <div className="h-6 bg-gray-200 w-3/4 rounded" />
                <div className="h-16 bg-gray-200 w-full rounded" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="neu-border bg-white dark:bg-black p-12 text-center shadow-[4px_4px_0_0_#000]">
            <h3 className="font-display text-xl font-bold mb-2">No news published yet.</h3>
            <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
              Check back later for newsletters, announcements, and articles from this club!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article: any) => (
              <ArticleCard key={article.id} article={article} clubSlug={slug} />
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="neu-border w-full max-w-2xl bg-white p-6 shadow-[8px_8px_0_0_#000]">
            <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-3">
              <h2 className="font-display text-xl font-bold uppercase">Publish Club News</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded border-2 border-transparent p-1 hover:border-black transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs font-bold uppercase" htmlFor="article-title">
                  Article Title
                </label>
                <input
                  id="article-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Monthly Newsletter - August 2026"
                  className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/10"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-xs font-bold uppercase" htmlFor="article-content">
                  Article Content (Markdown/HTML)
                </label>
                <textarea
                  id="article-content"
                  rows={10}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your article here..."
                  className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/10"
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t-2 border-black pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createArticleMutation.isPending}
                  className="neu-border bg-black text-cream hover:bg-cream hover:text-black px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50 flex items-center gap-2"
                >
                  {createArticleMutation.isPending && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
