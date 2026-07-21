import { FeedPostSkeleton } from "@/components/FeedPostSkeleton";
import { useMutation, useQuery, useInfiniteQuery } from "@/hooks/useReactQueryReplacement";
import type { User } from "@supabase/supabase-js";
import {
  Link2,
  ArrowUp,
  MessageCircle,
  MessageSquareText,
  PenLine,
  Pin,
  Sparkles,
  Trash2,
  Flame,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { calculateReadTime } from "@/utils/readTime";
import { PullToRefresh } from "@/components/PullToRefresh";

import { MarkdownEditor, type MarkdownEditorRef } from "@/components/MarkdownEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type MemberRole = "admin" | "organizer" | "member" | "alumni";

interface Profile {
  id: string;
  full_name: string | null;
}

interface ClubMember {
  user_id: string;
  role: MemberRole;
}

interface Club {
  id: string;
  name: string;
  club_members: ClubMember[] | ClubMember | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  profiles: Profile[] | Profile | null;
}

interface PostReaction {
  emoji: string;
  user_id: string;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  club_id: string;
  pinned: boolean;
  profiles: Profile[] | Profile | null;
  clubs: Club[] | Club | null;
  comments: Comment[] | null;
  post_reactions: PostReaction[] | null;
}

const POSTS_PER_PAGE = 10;

export default function Feed() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [newPost, setNewPost] = useState("");
  const editorRef = useRef<MarkdownEditorRef>(null);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  // Tracks a per-post, per-emoji "burst" nonce so the spring animation
  // replays on every like AND unlike toggle (key-remount trick).
  const [reactionBursts, setReactionBursts] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: userClubs = [] } = useQuery({
    queryKey: ["userClubs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data } = await supabase
        .from("club_members")
        .select("clubs (id, name)")
        .eq("user_id", user.id)
        .eq("status", "approved");

      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const [selectedClubId, setSelectedClubId] = useState("");
  const [feedMode, setFeedMode] = useState<"latest" | "trending">("latest");

  useEffect(() => {
    if (userClubs.length > 0 && !selectedClubId) {
      const firstClub = Array.isArray(userClubs[0].clubs)
        ? userClubs[0].clubs[0]
        : userClubs[0].clubs;

      if (firstClub) setSelectedClubId(firstClub.id);
    }
  }, [userClubs, selectedClubId]);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch: refetchPosts,
  } = useInfiniteQuery<{ posts: Post[]; nextPage?: number }>({
    queryKey: ["posts"],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("posts")
        .select(
          `
        id, content, created_at, club_id, pinned,
        profiles (id, full_name),
        clubs (id, name, club_members (user_id, role)),
        comments (id, content, created_at, deleted_at, profiles (id, full_name)),
        post_reactions (emoji, user_id)
      `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const posts = (data ?? []) as unknown as Post[];

      return {
        posts,
        nextPage: posts.length === POSTS_PER_PAGE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];
  const posts = [...allPosts].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  // Trending posts — fetched lazily only when the Trending tab is active
  const { data: trendingData, isLoading: isTrendingLoading } = useQuery<Post[]>({
    queryKey: ["trendingPosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trending_posts")
        .select(
          `
          id, content, created_at, club_id, pinned,
          profiles (id, full_name),
          clubs (id, name, club_members (user_id, role)),
          comments (id, content, created_at, deleted_at, profiles (id, full_name)),
          post_reactions (emoji, user_id)
        `,
        )
        .is("deleted_at", null)
        .order("hotness_score", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
    enabled: feedMode === "trending",
  });

  const trendingPosts: Post[] = trendingData ?? [];
  const activePosts = feedMode === "latest" ? posts : trendingPosts;
  const isActiveFeedLoading = feedMode === "latest" ? isLoading : isTrendingLoading;

  const postsRef = useRef(posts);
  const userRef = useRef(user);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const handleRefetch = useCallback(() => {
    setShowNewPostsBanner(false);
    refetchPosts();
  }, [refetchPosts]);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading, isFetchingNextPage, fetchNextPage, hasNextPage],
  );

  useEffect(() => {
    return () => observer.current?.disconnect();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const isOwnPost = payload.new && payload.new.author_id === userRef.current?.id;
          const alreadyExists = postsRef.current.some((p) => p.id === payload.new.id);
          if (!isOwnPost && !alreadyExists) {
            setShowNewPostsBanner(true);
            return;
          }
        }
        refetchPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        refetchPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        refetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetchPosts]);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (!selectedClubId) throw new Error("Select a club");

      const { error } = await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: newPost,
      });

      if (error) throw error;

      setNewPost("");
    },
    onSuccess: () => refetchPosts(),
    onError: (error) => {
      toast.error(error.message || "Failed to publish post.");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        content,
      });
      if (error) throw error;

      setNewComments((prev) => ({ ...prev, [postId]: "" }));
    },
    onSuccess: () => refetchPosts(),
    onError: (error) => {
      toast.error(error.message || "Failed to post comment. Please try again.");
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({
      postId,
      emoji,
      isReacted,
    }: {
      postId: string;
      emoji: string;
      isReacted: boolean;
    }) => {
      if (!user) throw new Error("Must be logged in");

      if (isReacted) {
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_reactions").insert({
          post_id: postId,
          user_id: user.id,
          emoji,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => refetchPosts(),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPosts();
      toast.success("Post deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete post.");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ postId, pinned }: { postId: string; pinned: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("posts").update({ pinned }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => refetchPosts(),
    onError: (error) => toast.error(error.message || "Failed to update pin."),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPosts();
      toast.success("Comment deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete comment.");
    },
  });

  const timeAgo = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return rtf.format(-days, "day");

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return rtf.format(-hours, "hour");

    const minutes = Math.floor(diff / (1000 * 60));
    return rtf.format(-Math.max(1, minutes), "minute");
  };
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <SiteShell>
      <PullToRefresh isRefreshing={isLoading || isFetching} onRefresh={handleRefetch}>
        <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
          <div className="mx-auto max-w-4xl">
            <p className="eyebrow font-bold">Discussion feed</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">
              What clubs are talking about.
            </h1>
          </div>
        </section>

        <section className="bg-cream px-4 py-12 md:px-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="space-y-3">
              <MarkdownEditor ref={editorRef} value={newPost} onChange={setNewPost} />

              <div className="neu-border flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <select
                  value={selectedClubId}
                  onChange={(event) => setSelectedClubId(event.target.value)}
                  className="bg-transparent font-mono text-xs outline-none"
                  aria-label="Choose club for post"
                >
                  {userClubs.length === 0 && <option value="">No clubs joined</option>}
                  {userClubs.map((userClub) => {
                    const club = Array.isArray(userClub.clubs) ? userClub.clubs[0] : userClub.clubs;

                    return club ? (
                      <option key={club.id} value={club.id}>
                        Posting to · {club.name}
                      </option>
                    ) : null;
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!user) return alert("Log in first");
                    if (!selectedClubId) return alert("Join or select a club first");
                    if (newPost.trim()) postMutation.mutate();
                  }}
                  disabled={!newPost.trim() || !selectedClubId || postMutation.isPending}
                  className="neu-border neu-press bg-black px-5 py-2 font-mono text-xs font-bold uppercase text-cream disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {postMutation.isPending ? "Posting…" : "Post Markdown"}
                </button>
              </div>

              {postMutation.isError && (
                <p className="neu-border bg-peach p-3 font-mono text-xs" role="alert">
                  Could not publish the post. Please try again.
                </p>
              )}
            </div>

            <style>{`
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>

            {/* ── Feed mode tabs ── */}
            <div
              role="tablist"
              aria-label="Feed mode"
              className="flex gap-2 border-b-2 border-black pb-4 dark:border-cream"
            >
              <button
                role="tab"
                type="button"
                id="tab-latest"
                aria-selected={feedMode === "latest"}
                onClick={() => setFeedMode("latest")}
                className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${
                  feedMode === "latest"
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`}
              >
                Latest
              </button>
              <button
                role="tab"
                type="button"
                id="tab-trending"
                aria-selected={feedMode === "trending"}
                onClick={() => setFeedMode("trending")}
                className={`neu-border inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${
                  feedMode === "trending"
                    ? "bg-black text-cream dark:bg-cream dark:text-black"
                    : "bg-white text-black hover:bg-cream/50 dark:bg-black dark:text-cream dark:hover:bg-white/10"
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                Trending
              </button>
            </div>

            {showNewPostsBanner && feedMode === "latest" && (
              <button
                type="button"
                onClick={handleRefetch}
                style={{
                  animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
                className="neu-border flex w-full items-center justify-center gap-2 bg-[#FFD93D] hover:bg-[#FFD93D]/90 py-3 text-center font-display text-sm font-bold uppercase transition-all shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[4px_4px_0_0_#000] cursor-pointer"
              >
                <Sparkles size={16} className="animate-pulse" />
                New posts available (Refresh)
              </button>
            )}

            {isActiveFeedLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <FeedPostSkeleton key={index} />
                ))}
              </div>
            ) : activePosts.length === 0 ? (
              <div
                className="neu-border relative overflow-hidden bg-white px-6 py-12 text-center sm:px-10 sm:py-16"
                role="status"
                aria-live="polite"
              >
                <div
                  className="absolute -left-6 -top-6 h-24 w-24 rotate-12 border-2 border-black bg-lime"
                  aria-hidden="true"
                />
                <div
                  className="absolute -bottom-8 -right-6 h-28 w-28 -rotate-12 border-2 border-black bg-peach"
                  aria-hidden="true"
                />

                <div className="relative mx-auto flex max-w-xl flex-col items-center">
                  <div className="relative mb-6" aria-hidden="true">
                    <div className="neu-border flex h-24 w-24 items-center justify-center bg-lime sm:h-28 sm:w-28">
                      <MessageCircle className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={2.5} />
                    </div>
                    <div className="neu-border absolute -right-4 -top-4 flex h-10 w-10 items-center justify-center bg-peach">
                      <Sparkles className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                  </div>

                  <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em]">
                    The conversation starts here
                  </p>
                  <h2 className="text-2xl font-bold sm:text-3xl">
                    No posts yet. Be the first to start a discussion!
                  </h2>
                  <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-gray-700">
                    Share an announcement, ask a question, or post an update for your club
                    community.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      editorRef.current?.focusWrite();
                    }}
                    className="neu-border mt-7 inline-flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    Start a discussion
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activePosts.map((post: Post, index: number) => {
                  const isLastPost = feedMode === "latest" && index === posts.length - 1;
                  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
                  const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;
                  const clubMembers: ClubMember[] = Array.isArray(club?.club_members)
                    ? club.club_members
                    : club?.club_members
                      ? [club.club_members]
                      : [];

                  const authorMembership = clubMembers.find((m) => m.user_id === author?.id);

                  const authorRole = (authorMembership?.role ?? "member") as MemberRole;

                  const postComments: Comment[] = Array.isArray(post.comments)
                    ? post.comments.filter((c) => !c.deleted_at)
                    : [];

                  return (
                    <article
                      id={`post-${post.id}`}
                      key={post.id}
                      ref={isLastPost ? lastPostElementRef : undefined}
                      className={`neu-border p-6 ${
                        post.pinned ? "bg-[#FFFBEA] border-[3px] border-[#F59E0B]" : "bg-white"
                      }`}
                    >
                      {post.pinned && (
                        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                          <Pin size={12} className="fill-[#B45309]" />
                          Pinned
                        </div>
                      )}
                      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                        <div>
                          <p className="font-display text-lg font-bold flex items-center gap-2">
                            {author?.full_name || "Unknown User"}
                            <RoleBadge role={authorRole} />
                          </p>
                          <p className="font-mono text-xs flex flex-wrap items-center">
                            in {club?.name || "Unknown Club"} · {timeAgo(post.created_at)}
                            <span className="text-gray-500 dark:text-gray-300 ml-1">
                              · {calculateReadTime(post.content)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const isClubAdmin =
                              clubMembers.some(
                                (m) => m.user_id === user?.id && m.role === "admin",
                              ) || userProfile?.role === "system_admin";
                            return isClubAdmin ? (
                              <button
                                type="button"
                                onClick={() =>
                                  pinMutation.mutate({ postId: post.id, pinned: !post.pinned })
                                }
                                disabled={pinMutation.isPending}
                                className={`neu-border neu-press flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer ${
                                  post.pinned
                                    ? "bg-[#FDE68A] hover:bg-[#FCD34D] text-black"
                                    : "bg-white hover:bg-cream text-black"
                                }`}
                                aria-label={post.pinned ? "Unpin post" : "Pin post"}
                              >
                                <Pin size={10} strokeWidth={2.5} />
                                {post.pinned ? "Unpin" : "Pin"}
                              </button>
                            ) : null;
                          })()}
                          {(user?.id === author?.id || userProfile?.role === "system_admin") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="neu-border neu-press flex items-center gap-1 bg-[#FF6B6B] hover:bg-[#FF8787] text-black px-2 py-1 font-mono text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer"
                                  aria-label="Delete post"
                                >
                                  <Trash2 size={10} strokeWidth={2.5} />
                                  Delete
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="neu-border bg-white rounded-none p-6">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-display text-xl font-bold">
                                    Delete post?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="font-mono text-sm text-gray-700">
                                    Are you sure you want to delete this post? This action cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                                  <AlertDialogCancel className="neu-border rounded-none font-mono text-xs font-bold uppercase bg-white text-black hover:bg-cream">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePostMutation.mutate(post.id)}
                                    className="neu-border bg-[#FF6B6B] text-black hover:bg-[#FF8787] rounded-none font-mono text-xs font-bold uppercase"
                                  >
                                    Confirm
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </header>

                      <div className="markdown-content mt-2 font-mono text-sm leading-relaxed">
                        <ReactMarkdown>{post.content}</ReactMarkdown>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {["👍", "👏", "🔥"].map((emoji) => {
                          const postReactions: PostReaction[] = Array.isArray(post.post_reactions)
                            ? post.post_reactions
                            : [];
                          const reactionCount = postReactions.filter(
                            (r) => r.emoji === emoji,
                          ).length;
                          const isReacted = postReactions.some(
                            (r) => r.emoji === emoji && r.user_id === user?.id,
                          );
                          const burstKey = `${post.id}-${emoji}`;
                          const burstNonce = reactionBursts[burstKey] ?? 0;

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                if (!user) return alert("Log in first");
                                // Bump the burst nonce so the emoji <span> remounts
                                // and the spring keyframe animation replays.
                                setReactionBursts((prev) => ({
                                  ...prev,
                                  [burstKey]: (prev[burstKey] ?? 0) + 1,
                                }));
                                reactionMutation.mutate({ postId: post.id, emoji, isReacted });
                              }}
                              className={`neu-border flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold transition-transform hover:-translate-y-0.5 ${
                                isReacted ? "bg-lime" : "bg-white hover:bg-cream"
                              }`}
                            >
                              {/* key includes burstNonce so React remounts the span
                                   on every click, retriggering the CSS animation. */}
                              <span
                                key={`${burstKey}-${burstNonce}`}
                                className="reaction-burst inline-flex items-center"
                              >
                                {emoji}
                              </span>
                              {reactionCount > 0 && <span>{reactionCount}</span>}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex gap-2 border-t-2 border-black pt-4">
                        <a
                          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(
                            `${window.location.origin}${window.location.pathname}#post-${post.id}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-[#1DA1F2] hover:text-white"
                        >
                          Twitter
                        </a>

                        <a
                          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                            `${window.location.origin}${window.location.pathname}#post-${post.id}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-[#0A66C2] hover:text-white"
                        >
                          LinkedIn
                        </a>

                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Check out this post: ${post.content.substring(0, 50)}... - ${window.location.origin}${window.location.pathname}#post-${post.id}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-[#25D366] hover:text-white"
                        >
                          WhatsApp
                        </a>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const shareUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
                              await navigator.clipboard.writeText(shareUrl);
                              toast.success("Link copied!");
                            } catch (err) {
                              toast.error("Failed to copy link.");
                            }
                          }}
                          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-lime hover:text-black cursor-pointer"
                        >
                          Copy Link
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
                        <h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase">
                          <MessageSquareText size={16} /> Comments ({postComments.length})
                        </h3>

                        <div className="space-y-4 pl-4">
                          {postComments.map((comment) => {
                            const commentAuthor = Array.isArray(comment.profiles)
                              ? comment.profiles[0]
                              : comment.profiles;

                            const commentAuthorMembership = clubMembers.find(
                              (m) => m.user_id === commentAuthor?.id,
                            );

                            return (
                              <div key={comment.id} className="neu-border bg-cream p-3">
                                <div className="flex justify-between">
                                  <p className="font-mono text-xs font-bold uppercase flex items-center gap-1.5">
                                    {commentAuthor?.full_name || "Unknown User"}
                                    <RoleBadge
                                      role={
                                        (commentAuthorMembership?.role ?? "member") as MemberRole
                                      }
                                    />
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-mono text-[10px] text-gray-500 dark:text-gray-300">
                                      {timeAgo(comment.created_at)}
                                    </p>
                                    {(user?.id === commentAuthor?.id ||
                                      userProfile?.role === "system_admin") && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <button
                                            type="button"
                                            className="text-[#FF6B6B] hover:text-[#FF8787] uppercase font-bold font-mono text-[10px]"
                                            aria-label="Delete comment"
                                          >
                                            Delete
                                          </button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="neu-border bg-white rounded-none p-6">
                                          <AlertDialogHeader>
                                            <AlertDialogTitle className="font-display text-xl font-bold">
                                              Delete comment?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="font-mono text-sm text-gray-700">
                                              Are you sure you want to delete this comment?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                                            <AlertDialogCancel className="neu-border rounded-none font-mono text-xs font-bold uppercase bg-white text-black hover:bg-cream">
                                              Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() =>
                                                deleteCommentMutation.mutate(comment.id)
                                              }
                                              className="neu-border bg-[#FF6B6B] text-black hover:bg-[#FF8787] rounded-none font-mono text-xs font-bold uppercase"
                                            >
                                              Confirm
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </div>
                                </div>
                                <div className="markdown-content mt-1 font-mono text-sm">
                                  <ReactMarkdown>{comment.content}</ReactMarkdown>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <input
                            value={newComments[post.id] || ""}
                            onChange={(event) =>
                              setNewComments((prev) => ({
                                ...prev,
                                [post.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                if (!user) return alert("Log in first");

                                const content = newComments[post.id];
                                if (content?.trim()) {
                                  commentMutation.mutate({ postId: post.id, content });
                                }
                              }
                            }}
                            placeholder="Reply..."
                            className="neu-border w-full bg-white px-3 py-2 font-mono text-sm outline-none"
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </>
            )}

            {isFetchingNextPage &&
              Array.from({ length: 2 }).map((_, i) => (
                <div key={`loading-${i}`} className="neu-border bg-white p-6 animate-pulse">
                  <div className="h-6 w-1/3 rounded bg-gray-200" />
                  <div className="mt-4 h-4 w-full rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-5/6 rounded bg-gray-200" />
                </div>
              ))}

            {!hasNextPage && posts.length > 0 && (
              <div className="py-10 text-center font-mono text-sm font-bold text-gray-500 dark:text-gray-300 uppercase">
                You're all caught up! 🎉
              </div>
            )}
          </div>
        </section>
      </PullToRefresh>

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 neu-border bg-black p-3 text-cream transition-transform hover:-translate-y-1"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </SiteShell>
  );
}
