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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  // IntersectionObserver hook setup
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.5,
  });

  const fetchPosts = useCallback(
    async (pageNumber: number) => {
      if (isLoading) return;
      setIsLoading(true);

      const start = pageNumber * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      // Fetch range of posts using Supabase pagination
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .range(start, end);

      if (error) {
        console.error("Error fetching posts:", error);
      } else if (data) {
        setPosts((prevPosts) => (pageNumber === 0 ? data : [...prevPosts, ...data]));

        // If less than PAGE_SIZE returned, we reached the end of the feed
        if (data.length < PAGE_SIZE) {
          setHasMore(false);
        }
      }

      setIsLoading(false);
    },
    [isLoading],
  );

  // Initial load on component mount
  useEffect(() => {
    fetchPosts(0);
  }, []);

  // Trigger fetch when scrolling down to the sentinel
  useEffect(() => {
    if (inView && hasMore && !isLoading && page > 0) {
      fetchPosts(page);
    }
  }, [inView, hasMore, isLoading, page, fetchPosts]);

  // Advance page counter when sentinel comes into view
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [inView, hasMore, isLoading]);

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
