import React, { useState, useEffect, useCallback } from "react";
import { useInView } from "react-intersection-observer";
import { supabase } from "@/lib/supabase/client";
import { Flag } from "lucide-react";
import { ReportDialog } from "@/components/ReportDialog";
import { RelayConnection, encodeRelayCursor, decodeRelayCursor } from "@/lib/relayPagination";

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
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  // IntersectionObserver hook setup
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.5,
  });

  const fetchPosts = useCallback(
    async (afterCursor: string | null) => {
      if (isLoading) return;
      setIsLoading(true);

      // Try get_posts_relay RPC first
      const { data: relayData, error: relayError } = await supabase.rpc("get_posts_relay", {
        p_after: afterCursor,
        p_first: PAGE_SIZE,
      });

      if (!relayError && relayData && typeof relayData === "object" && "edges" in relayData) {
        const connection = relayData as unknown as RelayConnection<Post>;
        const newPosts = connection.edges.map((edge) => edge.node);
        setPosts((prevPosts) => (afterCursor === null ? newPosts : [...prevPosts, ...newPosts]));
        setHasMore(connection.pageInfo.hasNextPage);
        setEndCursor(connection.pageInfo.endCursor);
        setIsLoading(false);
        return;
      }

      // Fallback using get_posts_cursor
      const decoded = afterCursor ? decodeRelayCursor(afterCursor) : null;
      const { data, error } = await supabase.rpc("get_posts_cursor", {
        last_created_at: decoded?.createdAt || null,
        last_id: decoded?.id || null,
        fetch_limit: PAGE_SIZE,
      });

      if (error) {
        console.error("Error fetching posts:", error);
      } else if (data) {
        const fetchedPosts = data as unknown as Post[];
        setPosts((prevPosts) =>
          afterCursor === null ? fetchedPosts : [...prevPosts, ...fetchedPosts],
        );

        setHasMore(fetchedPosts.length === PAGE_SIZE);
        if (fetchedPosts.length > 0) {
          const lastPost = fetchedPosts[fetchedPosts.length - 1];
          const newCursor = encodeRelayCursor(
            String(lastPost.created_at || ""),
            String(lastPost.id),
          );
          setEndCursor(newCursor);
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
    if (inView && hasMore && !isLoading && endCursor) {
      fetchPosts(endCursor);
    }
  }, [inView, hasMore, isLoading, endCursor, fetchPosts]);

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
