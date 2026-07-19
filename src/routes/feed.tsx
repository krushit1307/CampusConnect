import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import {
  MessageCircle,
  MessageSquareText,
  PenLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { FeedPostSkeleton } from "@/components/FeedPostSkeleton";
import {
  MarkdownEditor,
  type MarkdownEditorRef,
} from "@/components/MarkdownEditor";
import { PullToRefresh } from "@/components/PullToRefresh";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
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
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { calculateReadTime } from "@/utils/readTime";

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
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [selectedClubId, setSelectedClubId] = useState("");
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);

  const editorRef = useRef<MarkdownEditorRef>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const postsRef = useRef<Post[]>([]);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase]);

  const { data: userClubs = [] } = useQuery({
    queryKey: ["userClubs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("club_members")
        .select("clubs (id, name)")
        .eq("user_id", user.id)
        .eq("status", "approved");

      if (error) throw error;

      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (userClubs.length > 0 && !selectedClubId) {
      const firstClub = Array.isArray(userClubs[0].clubs)
        ? userClubs[0].clubs[0]
        : userClubs[0].clubs;

      if (firstClub) {
        setSelectedClubId(firstClub.id);
      }
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
            id,
            content,
            created_at,
            club_id,
            profiles (id, full_name),
            clubs (
              id,
              name,
              club_members (user_id, role)
            ),
            comments (
              id,
              content,
              created_at,
              deleted_at,
              profiles (id, full_name)
            ),
            post_reactions (emoji, user_id)
          `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      const posts = (data ?? []) as unknown as Post[];

      return {
        posts,
        nextPage:
          posts.length === POSTS_PER_PAGE ? pageParam + 1 : undefined,
      };
    },

    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

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

  const lastPostElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading || isFetchingNextPage) return;

      if (observer.current) {
        observer.current.disconnect();
      }

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) {
        observer.current.observe(node);
      }
    },
    [isLoading, isFetchingNextPage, fetchNextPage, hasNextPage],
  );

  useEffect(() => {
    return () => {
      observer.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime_feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          const isOwnPost =
            payload.new &&
            payload.new.author_id === userRef.current?.id;

          const alreadyExists = postsRef.current.some(
            (post) => post.id === payload.new.id,
          );

          if (!isOwnPost && !alreadyExists) {
            setShowNewPostsBanner(true);
            return;
          }

          refetchPosts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        () => {
          refetchPosts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_reactions",
        },
        () => {
          refetchPosts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetchPosts]);

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Must be logged in");
      }

      if (!selectedClubId) {
        throw new Error("Select a club");
      }

      const { error } = await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: newPost,
      });

      if (error) {
        throw error;
      }

      setNewPost("");
    },

    onSuccess: () => {
      refetchPosts();
    },

    onError: (error) => {
      toast.error(error.message || "Failed to publish post.");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) {
        throw new Error("Must be logged in");
      }

      const { error } = await supabase
        .from("posts")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      refetchPosts();
      toast.success("Post deleted successfully!");
    },

    onError: () => {
      toast.error("Failed to delete post.");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: string;
      content: string;
    }) => {
      if (!user) {
        throw new Error("Must be logged in");
      }

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        content,
      });

      if (error) {
        throw error;
      }

      setNewComments((previous) => ({
        ...previous,
        [postId]: "",
      }));
    },

    onSuccess: () => {
      refetchPosts();
    },

    onError: (error) => {
      toast.error(
        error.message || "Failed to post comment. Please try again.",
      );
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) {
        throw new Error("Must be logged in");
      }

      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        throw error;
      }
    },

    onSuccess: () => {
      refetchPosts();
      toast.success("Comment deleted successfully!");
    },

    onError: () => {
      toast.error("Failed to delete comment.");
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
      if (!user) {
        throw new Error("Must be logged in");
      }

      if (isReacted) {
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("post_reactions")
          .insert({
            post_id: postId,
            user_id: user.id,
            emoji,
          });

        if (error) {
          throw error;
        }
      }
    },

    onSuccess: () => {
      refetchPosts();
    },
  });

  const timeAgo = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat("en", {
      numeric: "auto",
    });

    const diff =
      new Date().getTime() - new Date(dateString).getTime();

    const days = Math.floor(
      diff / (1000 * 60 * 60 * 24),
    );

    if (days > 0) {
      return rtf.format(-days, "day");
    }

    const hours = Math.floor(
      diff / (1000 * 60 * 60),
    );

    if (hours > 0) {
      return rtf.format(-hours, "hour");
    }

    const minutes = Math.floor(
      diff / (1000 * 60),
    );

    return rtf.format(
      -Math.max(1, minutes),
      "minute",
    );
  };

  return (
    <SiteShell>
      <PullToRefresh
        isRefreshing={isLoading || isFetching}
        onRefresh={handleRefetch}
      >
        <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
          <div className="mx-auto max-w-4xl">
            <p className="eyebrow font-bold">
              Discussion feed
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">
              What clubs are talking about.
            </h1>
          </div>
        </section>

        <section className="bg-cream px-4 py-12 md:px-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="space-y-3">
              <MarkdownEditor
                ref={editorRef}
                value={newPost}
                onChange={setNewPost}
              />

              <div className="neu-border flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <select
                  value={selectedClubId}
                  onChange={(event) =>
                    setSelectedClubId(event.target.value)
                  }
                  className="bg-transparent font-mono text-xs outline-none"
                  aria-label="Choose club for post"
                >
                  {userClubs.length === 0 && (
                    <option value="">
                      No clubs joined
                    </option>
                  )}

                  {userClubs.map((userClub) => {
                    const club = Array.isArray(
                      userClub.clubs,
                    )
                      ? userClub.clubs[0]
                      : userClub.clubs;

                    return club ? (
                      <option
                        key={club.id}
                        value={club.id}
                      >
                        Posting to · {club.name}
                      </option>
                    ) : null;
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      return alert("Log in first");
                    }

                    if (!selectedClubId) {
                      return alert(
                        "Join or select a club first",
                      );
                    }

                    if (newPost.trim()) {
                      postMutation.mutate();
                    }
                  }}
                  disabled={
                    !newPost.trim() ||
                    !selectedClubId ||
                    postMutation.isPending
                  }
                  className="neu-border neu-press bg-black px-5 py-2 font-mono text-xs font-bold uppercase text-cream disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {postMutation.isPending
                    ? "Posting…"
                    : "Post Markdown"}
                </button>
              </div>

              {postMutation.isError && (
                <p
                  className="neu-border bg-peach p-3 font-mono text-xs"
                  role="alert"
                >
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

            {showNewPostsBanner && (
              <button
                type="button"
                onClick={handleRefetch}
                style={{
                  animation:
                    "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
                className="neu-border flex w-full cursor-pointer items-center justify-center gap-2 bg-[#FFD93D] py-3 text-center font-display text-sm font-bold uppercase shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:bg-[#FFD93D]/90 hover:shadow-[6px_6px_0_0_#000] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[4px_4px_0_0_#000]"
              >
                <Sparkles
                  size={16}
                  className="animate-pulse"
                />
                New posts available (Refresh)
              </button>
            )}

            {isLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 5 }).map(
                  (_, index) => (
                    <FeedPostSkeleton
                      key={index}
                    />
                  ),
                )}
              </div>
            ) : posts.length === 0 ? (
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
                  <div
                    className="relative mb-6"
                    aria-hidden="true"
                  >
                    <div className="neu-border flex h-24 w-24 items-center justify-center bg-lime sm:h-28 sm:w-28">
                      <MessageCircle
                        className="h-12 w-12 sm:h-14 sm:w-14"
                        strokeWidth={2.5}
                      />
                    </div>

                    <div className="neu-border absolute -right-4 -top-4 flex h-10 w-10 items-center justify-center bg-peach">
                      <Sparkles
                        className="h-5 w-5"
                        strokeWidth={2.5}
                      />
                    </div>
                  </div>

                  <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em]">
                    The conversation starts here
                  </p>

                  <h2 className="text-2xl font-bold sm:text-3xl">
                    No posts yet. Be the first to start a
                    discussion!
                  </h2>

                  <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    Share an announcement, ask a question,
                    or post an update for your club
                    community.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      editorRef.current?.focusWrite();
                    }}
                    className="neu-border mt-7 inline-flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                  >
                    <PenLine
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    Start a discussion
                  </button>
                </div>
              </div>
            ) : (
              <>
                {posts.map((post, index) => {
                  const author = Array.isArray(
                    post.profiles,
                  )
                    ? post.profiles[0]
                    : post.profiles;

                  const club = Array.isArray(post.clubs)
                    ? post.clubs[0]
                    : post.clubs;

                  const clubMembers: ClubMember[] =
                    Array.isArray(club?.club_members)
                      ? club.club_members
                      : club?.club_members
                        ? [club.club_members]
                        : [];

                  const authorMembership =
                    clubMembers.find(
                      (member) =>
                        member.user_id === author?.id,
                    );

                  const authorRole =
                    (authorMembership?.role ??
                      "member") as MemberRole;

                  const postComments: Comment[] =
                    Array.isArray(post.comments)
                      ? post.comments.filter(
                          (comment) =>
                            !comment.deleted_at,
                        )
                      : [];

                  const isLastPost =
                    index === posts.length - 1;

                  return (
                    <article
                      id={`post-${post.id}`}
                      key={post.id}
                      ref={
                        isLastPost
                          ? lastPostElementRef
                          : undefined
                      }
                      className="neu-border bg-white p-6"
                    >
                      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                        <div>
                          <p className="flex items-center gap-2 font-display text-lg font-bold">
                            {author?.full_name ||
                              "Unknown User"}

                            <RoleBadge
                              role={authorRole}
                            />
                          </p>

                          <p className="flex flex-wrap items-center font-mono text-xs">
                            in{" "}
                            {club?.name ||
                              "Unknown Club"}{" "}
                            ·{" "}
                            {timeAgo(
                              post.created_at,
                            )}

                            <span className="ml-1 text-gray-500">
                              ·{" "}
                              {calculateReadTime(
                                post.content,
                              )}
                            </span>
                          </p>
                        </div>

                        {(user?.id === author?.id ||
                          userProfile?.role ===
                            "system_admin") && (
                          <AlertDialog>
                            <AlertDialogTrigger
                              asChild
                            >
                              <button
                                type="button"
                                className="neu-border neu-press flex cursor-pointer items-center gap-1 bg-[#FF6B6B] px-2 py-1 font-mono text-[10px] font-bold uppercase text-black transition-all duration-300 hover:bg-[#FF8787]"
                                aria-label="Delete post"
                              >
                                <Trash2
                                  size={10}
                                  strokeWidth={2.5}
                                />
                                Delete
                              </button>
                            </AlertDialogTrigger>

                            <AlertDialogContent className="neu-border rounded-none bg-white p-6">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display text-xl font-bold">
                                  Delete post?
                                </AlertDialogTitle>

                                <AlertDialogDescription className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                  Are you sure you want
                                  to delete this post?
                                  This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                                <AlertDialogCancel className="neu-border rounded-none bg-white font-mono text-xs font-bold uppercase text-black hover:bg-cream">
                                  Cancel
                                </AlertDialogCancel>

                                <AlertDialogAction
                                  onClick={() =>
                                    deletePostMutation.mutate(
                                      post.id,
                                    )
                                  }
                                  className="neu-border rounded-none bg-[#FF6B6B] font-mono text-xs font-bold uppercase text-black hover:bg-[#FF8787]"
                                >
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </header>

                      <div className="markdown-content mt-2 font-mono text-sm leading-relaxed">
                        <ReactMarkdown>
                          {post.content}
                        </ReactMarkdown>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {["👍", "👏", "🔥"].map(
                          (emoji) => {
                            const postReactions =
                              Array.isArray(
                                post.post_reactions,
                              )
                                ? post.post_reactions
                                : [];

                            const reactionCount =
                              postReactions.filter(
                                (reaction) =>
                                  reaction.emoji ===
                                  emoji,
                              ).length;

                            const isReacted =
                              postReactions.some(
                                (reaction) =>
                                  reaction.emoji ===
                                    emoji &&
                                  reaction.user_id ===
                                    user?.id,
                              );

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  if (!user) {
                                    return alert(
                                      "Log in first",
                                    );
                                  }

                                  reactionMutation.mutate(
                                    {
                                      postId: post.id,
                                      emoji,
                                      isReacted,
                                    },
                                  );
                                }}
                                className={`neu-border flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold transition-transform hover:-translate-y-0.5 ${
                                  isReacted
                                    ? "bg-lime"
                                    : "bg-white hover:bg-cream"
                                }`}
                              >
                                <span>{emoji}</span>

                                {reactionCount > 0 && (
                                  <span>
                                    {reactionCount}
                                  </span>
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-black pt-4">
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
                            `Check out this post: ${post.content.substring(
                              0,
                              50,
                            )}... - ${window.location.origin}${window.location.pathname}#post-${post.id}`,
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

                              await navigator.clipboard.writeText(
                                shareUrl,
                              );

                              toast.success(
                                "Link copied!",
                              );
                            } catch {
                              toast.error(
                                "Failed to copy link.",
                              );
                            }
                          }}
                          className="neu-border cursor-pointer px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-lime hover:text-black"
                        >
                          Copy Link
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
                        <h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase">
                          <MessageSquareText
                            size={16}
                          />
                          Comments (
                          {postComments.length})
                        </h3>

                        <div className="space-y-4 pl-4">
                          {postComments.map(
                            (comment) => {
                              const commentAuthor =
                                Array.isArray(
                                  comment.profiles,
                                )
                                  ? comment.profiles[0]
                                  : comment.profiles;

                              const commentAuthorMembership =
                                clubMembers.find(
                                  (member) =>
                                    member.user_id ===
                                    commentAuthor?.id,
                                );

                              return (
                                <div
                                  key={comment.id}
                                  className="neu-border bg-cream p-3"
                                >
                                  <div className="flex justify-between gap-3">
                                    <p className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase">
                                      {commentAuthor?.full_name ||
                                        "Unknown User"}

                                      <RoleBadge
                                        role={
                                          (commentAuthorMembership?.role ??
                                            "member") as MemberRole
                                        }
                                      />
                                    </p>

                                    <div className="flex items-center gap-2">
                                      <p className="font-mono text-[10px] text-gray-500">
                                        {timeAgo(
                                          comment.created_at,
                                        )}
                                      </p>

                                      {(user?.id ===
                                        commentAuthor?.id ||
                                        userProfile?.role ===
                                          "system_admin") && (
                                        <AlertDialog>
                                          <AlertDialogTrigger
                                            asChild
                                          >
                                            <button
                                              type="button"
                                              className="font-mono text-[10px] font-bold uppercase text-[#FF6B6B] hover:text-[#FF8787]"
                                              aria-label="Delete comment"
                                            >
                                              Delete
                                            </button>
                                          </AlertDialogTrigger>

                                          <AlertDialogContent className="neu-border rounded-none bg-white p-6">
                                            <AlertDialogHeader>
                                              <AlertDialogTitle className="font-display text-xl font-bold">
                                                Delete comment?
                                              </AlertDialogTitle>

                                              <AlertDialogDescription className="font-mono text-sm text-gray-700">
                                                Are you sure you
                                                want to delete
                                                this comment?
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>

                                            <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                                              <AlertDialogCancel className="neu-border rounded-none bg-white font-mono text-xs font-bold uppercase text-black hover:bg-cream">
                                                Cancel
                                              </AlertDialogCancel>

                                              <AlertDialogAction
                                                onClick={() =>
                                                  deleteCommentMutation.mutate(
                                                    comment.id,
                                                  )
                                                }
                                                className="neu-border rounded-none bg-[#FF6B6B] font-mono text-xs font-bold uppercase text-black hover:bg-[#FF8787]"
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
                                    <ReactMarkdown>
                                      {comment.content}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            value={
                              newComments[post.id] ||
                              ""
                            }
                            onChange={(event) =>
                              setNewComments(
                                (previous) => ({
                                  ...previous,
                                  [post.id]:
                                    event.target.value,
                                }),
                              )
                            }
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter" &&
                                !event.shiftKey
                              ) {
                                event.preventDefault();

                                if (!user) {
                                  return alert(
                                    "Log in first",
                                  );
                                }

                                const content =
                                  newComments[
                                    post.id
                                  ];

                                if (content?.trim()) {
                                  commentMutation.mutate(
                                    {
                                      postId: post.id,
                                      content,
                                    },
                                  );
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

                {isFetchingNextPage && (
                  <div className="py-4 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                  </div>
                )}

                {!hasNextPage && posts.length > 0 && (
                  <div className="py-10 text-center font-mono text-sm font-bold uppercase text-gray-500">
                    You're all caught up! 🎉
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </PullToRefresh>
    </SiteShell>
  );
}
