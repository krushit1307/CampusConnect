import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, User } from "lucide-react";
import { formatStandardDate } from "@/utils/dateUtils";

interface ArticleCardProps {
  article: {
    id: string;
    club_id: string;
    title: string;
    content: string;
    read_time_minutes: number | null;
    created_at: string;
    profiles?: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    } | null;
  };
  clubSlug: string;
}

export function ArticleCard({ article, clubSlug }: ArticleCardProps) {
  // Strip HTML to display preview snippet
  const snippet = article.content
    ? article.content.replace(/(<([^>]+)>)/gi, "").slice(0, 160) + (article.content.length > 160 ? "..." : "")
    : "";

  const authorName = article.profiles
    ? `${article.profiles.first_name} ${article.profiles.last_name}`
    : "Club Writer";

  const readTimeStr = article.read_time_minutes 
    ? `${article.read_time_minutes} min read`
    : "1 min read";

  return (
    <article className="neu-border bg-white dark:bg-black p-5 flex flex-col justify-between gap-4 transition-transform hover:-translate-y-1 shadow-[4px_4px_0_0_#000]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase font-bold text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatStandardDate(article.created_at)}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
            <BookOpen size={12} />
            {readTimeStr}
          </span>
        </div>
        <Link to={`/clubs/${clubSlug}/articles/${article.id}`}>
          <h3 className="font-display text-lg font-bold hover:underline line-clamp-2 text-black dark:text-cream">
            {article.title}
          </h3>
        </Link>
        <p className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-3">
          {snippet}
        </p>
      </div>

      <div className="border-t border-black pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
          <div className="h-5 w-5 rounded-full border border-black bg-lime flex items-center justify-center text-[9px] uppercase font-black text-black">
            {authorName.charAt(0)}
          </div>
          <span className="text-black dark:text-white">{authorName}</span>
        </div>
        <Link
          to={`/clubs/${clubSlug}/articles/${article.id}`}
          className="font-mono text-xs font-black underline uppercase hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Read Article
        </Link>
      </div>
    </article>
  );
}
