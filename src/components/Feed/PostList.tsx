import React, { useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { supabase } from "@/lib/supabase/client";
import { Flag } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";

const PAGE_SIZE = 10;

// Defined interface to satisfy ESLint typescript rules
interface Post {
  id: string | number;
  title?: string;
  content?: string;
  created_at?: string;
  [key: string]: unknown; // Allows additional dynamic fields without using `any`
}

export const PostList = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<{ created_at: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  // IntersectionObserver hook setup
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.5,
  });

  const fetchPosts = useCallback(
    async (currentCursor: { created_at: string; id: string } | null) => {
      if (isLoading) return;
      setIsLoading(true);

      const { data, error } = await supabase.rpc("get_posts_cursor", {
        last_created_at: currentCursor?.created_at || null,
        last_id: currentCursor?.id || null,
        fetch_limit: PAGE_SIZE,
      });

      if (error) {
        console.error("Error fetching posts:", error);
      } else if (data) {
        setPosts((prevPosts) =>
          currentCursor === null
            ? (data as unknown as Post[])
            : [...prevPosts, ...(data as unknown as Post[])],
        );

        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        }

        if (data.length > 0) {
          const lastPost = data[data.length - 1];
          setCursor({ created_at: lastPost.created_at, id: lastPost.id });
        }
      }

      setIsLoading(false);
    },
    [isLoading],
  );

  // Initial load on component mount
  useEffect(() => {
    fetchPosts(null);
  }, []);

  // Trigger fetch when scrolling down to the sentinel
  useEffect(() => {
    if (inView && hasMore && !isLoading && cursor) {
      fetchPosts(cursor);
    }
  }, [inView, hasMore, isLoading, cursor, fetchPosts]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full p-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className="p-4 border rounded-lg shadow-sm bg-card text-card-foreground flex flex-col justify-between"
        >
          <div>
            <h3 className="font-bold text-lg">{post.title || "Untitled Post"}</h3>
            <p className="mt-2 text-muted-foreground">{post.content}</p>
          </div>
          <div className="mt-3 flex items-center justify-end border-t pt-2">
            <button
              type="button"
              onClick={() => setReportPostId(String(post.id))}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              aria-label={`Report post ${post.title || post.id}`}
            >
              <Flag size={14} /> Report
            </button>
          </div>
        </div>
      ))}

      {/* Sentinel element observed by IntersectionObserver */}
      <div ref={sentinelRef} className="h-12 flex items-center justify-center p-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading more posts...</p>}
        {!hasMore && posts.length > 0 && (
          <p className="text-sm text-muted-foreground">You've reached the end of the feed!</p>
        )}
      </div>

      <ReportDialog
        isOpen={!!reportPostId}
        onClose={() => setReportPostId(null)}
        targetType="post"
        targetId={reportPostId || ""}
      />
    </div>
  );
};

export default PostList;
