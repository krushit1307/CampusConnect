import React, { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { supabase } from "@/lib/supabase/client";
import Flag from "lucide-react/dist/esm/icons/flag";
import { ReportDialog } from "@/components/ReportDialog";
import { RelayConnection, encodeRelayCursor, decodeRelayCursor } from "@/lib/relayPagination";
import { useInfiniteQuery } from "@/hooks/useReactQueryReplacement";
import { ClubAffiliationBadges } from "@/components/ClubAffiliationBadges";

const PAGE_SIZE = 10;

// Defined interface to satisfy ESLint typescript rules
interface Post {
  id: string | number;
  title?: string;
  content?: string;
  author_id?: string;
  user_id?: string;
  author_name?: string;
  display_badges?: boolean;
  created_at?: string;
  [key: string]: unknown; // Allows additional dynamic fields without using `any`
}

export const PostList = () => {
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  // IntersectionObserver hook setup
  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.5,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<
    RelayConnection<Post>,
    Error,
    string | undefined
  >({
    queryKey: ["postList"],
    queryFn: async ({ pageParam }) => {
      const afterCursor = pageParam;
      // Try get_posts_relay RPC first
      const { data: relayData, error: relayError } = await supabase.rpc("get_posts_relay", {
        p_after: afterCursor ?? null,
        p_first: PAGE_SIZE,
      });

      if (!relayError && relayData && typeof relayData === "object" && "edges" in relayData) {
        return relayData as unknown as RelayConnection<Post>;
      }

      // Fallback using get_posts_cursor
      const decoded = afterCursor ? decodeRelayCursor(afterCursor) : null;
      const { data: cursorData, error: cursorError } = await supabase.rpc("get_posts_cursor", {
        last_created_at: decoded?.createdAt || null,
        last_id: decoded?.id || null,
        fetch_limit: PAGE_SIZE,
      });

      if (cursorError) {
        throw cursorError;
      }

      const fetchedPosts = (cursorData ?? []) as unknown as Post[];
      const edges = fetchedPosts.map((post) => ({
        cursor: encodeRelayCursor(String(post.created_at || ""), String(post.id)),
        node: post,
      }));

      const hasNext = fetchedPosts.length === PAGE_SIZE;
      const startCursor = edges.length > 0 ? edges[0].cursor : null;
      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        pageInfo: {
          hasNextPage: hasNext,
          hasPreviousPage: !!afterCursor,
          startCursor,
          endCursor,
        },
      } as RelayConnection<Post>;
    },
    getNextPageParam: (lastPage: RelayConnection<Post>) =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
  });

  // Trigger fetch when scrolling down to the sentinel
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts =
    data?.pages.flatMap((page: RelayConnection<Post>) => page.edges.map((edge) => edge.node)) ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full p-4">
      {posts.map((post: Post) => {
        const postAuthorId = (post.author_id || post.user_id) as string | undefined;
        const displayBadges = post.display_badges !== false;

        return (
          <div
            key={post.id}
            className="p-4 border rounded-lg shadow-sm bg-card text-card-foreground flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-sm text-black dark:text-cream">
                  {post.author_name || (postAuthorId ? `User_${String(postAuthorId).substring(0, 4)}` : "Anonymous")}
                </span>
                {postAuthorId && (
                  <ClubAffiliationBadges userId={postAuthorId} displayBadges={displayBadges} size="xs" />
                )}
              </div>
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
        );
      })}

      {/* Sentinel element observed by IntersectionObserver */}
      <div ref={sentinelRef} className="h-12 flex items-center justify-center p-4">
        {isLoading || isFetchingNextPage ? (
          <p className="text-sm text-muted-foreground">Loading more posts...</p>
        ) : !hasNextPage && posts.length > 0 ? (
          <p className="text-sm text-muted-foreground">You've reached the end of the feed!</p>
        ) : null}
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
