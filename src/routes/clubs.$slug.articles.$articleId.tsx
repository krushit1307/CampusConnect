import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, BookOpen, Calendar, Loader2, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatStandardDate } from "@/utils/dateUtils";
import { useBreadcrumbs } from "@/components/BreadcrumbsContext";

export default function ClubArticleDetailsPage() {
  const { slug = "", articleId = "", lang = "en" } = useParams();
  const supabase = createClient();
  const { setCustomTrail } = useBreadcrumbs();

  // Query Club details by slug
  const { data: club, isLoading: isClubLoading } = useQuery({
    queryKey: ["clubBySlug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(slug),
  });

  // Query Article details by ID
  const { data: article, isLoading: isArticleLoading } = useQuery({
    queryKey: ["articleDetail", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          `
          id, club_id, title, content, read_time_minutes, created_at,
          profiles (first_name, last_name, avatar_url)
        `,
        )
        .eq("id", articleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(articleId),
  });

  // Set breadcrumbs trail override
  useEffect(() => {
    if (!club || !article) {
      const skeleton = (
        <span className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700 inline-block align-middle" />
      );
      setCustomTrail([
        { label: "Home", path: `/${lang}` },
        { label: "Clubs", path: `/${lang}/clubs` },
        { label: skeleton },
        { label: "News", path: club ? `/${lang}/clubs/${club.slug}/articles` : undefined },
        { label: skeleton },
      ]);
      return;
    }

    setCustomTrail([
      { label: "Home", path: `/${lang}` },
      { label: "Clubs", path: `/${lang}/clubs` },
      { label: club.name, path: `/${lang}/clubs/${club.slug}` },
      { label: "News", path: `/${lang}/clubs/${club.slug}/articles` },
      { label: article.title },
    ]);

    return () => setCustomTrail(null);
  }, [club, article, lang, setCustomTrail]);

  if (isClubLoading || isArticleLoading) {
    return (
      <SiteShell>
        <div className="flex h-64 w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      </SiteShell>
    );
  }

  if (!article) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl font-bold mb-4">Article Not Found</h2>
          <p className="font-mono text-sm text-gray-700 mb-6">
            The article you are looking for does not exist or has been deleted.
          </p>
          <Link
            to={`/clubs/${slug}/articles`}
            className="neu-border bg-black text-cream px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream hover:text-black inline-block"
          >
            Back to Club News
          </Link>
        </div>
      </SiteShell>
    );
  }

  const authorName =
    article.profiles && Array.isArray(article.profiles) && article.profiles.length > 0
      ? `${article.profiles[0].first_name} ${article.profiles[0].last_name}`
      : "Club Writer";

  const readTimeStr = article.read_time_minutes
    ? `${article.read_time_minutes} min read`
    : "1 min read";

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <Link
            to={`/clubs/${slug}/articles`}
            className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-gray-500 hover:underline"
          >
            <ArrowLeft size={12} /> Back to News list
          </Link>
        </div>

        <article className="neu-border bg-white dark:bg-black p-6 md:p-8 shadow-[8px_8px_0_0_#000]">
          <header className="mb-6 border-b-2 border-black pb-6">
            <h1 className="font-display text-2xl md:text-4xl font-black uppercase text-indigo-900 tracking-tight mb-4">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-bold text-gray-500">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full border border-black bg-lime flex items-center justify-center text-[10px] uppercase font-black text-black">
                  {authorName.charAt(0)}
                </div>
                <span className="text-black dark:text-white">{authorName}</span>
              </div>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatStandardDate(article.created_at)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <BookOpen size={14} />
                {readTimeStr}
              </span>
            </div>
          </header>

          <section className="markdown-content font-mono text-sm leading-relaxed text-black dark:text-cream">
            <ReactMarkdown>{article.content}</ReactMarkdown>
          </section>
        </article>
      </div>
    </SiteShell>
  );
}
