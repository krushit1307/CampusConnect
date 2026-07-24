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
  Flag,
  MoreVertical,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { VideoEmbed } from "@/components/VideoEmbed";
import { toast } from "sonner";
import { RoleBadge } from "@/components/RoleBadge";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { calculateReadTime } from "@/utils/readTime";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import CompressWorker from "@/workers/compress.worker?worker";

import {
  MarkdownEditorWithMentions,
  type MarkdownEditorWithMentionsRef,
} from "@/components/MarkdownEditorWithMentions";
import { MentionRenderer } from "@/components/MentionRenderer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ShareMenu } from "@/components/ui/ShareMenu";
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
  handle?: string | null;
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
  parent_comment_id?: string | null;
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
  is_pinned: boolean;
  profiles: Profile[] | Profile | null;
  clubs: Club[] | Club | null;
  comments: Comment[] | null;
  post_reactions: PostReaction[] | null;
}

const POSTS_PER_PAGE = 10;
const COMMENTS_PAGE_SIZE = 5;

export default function Feed() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();
  const [newPost, setNewPost] = useState("");
  const editorRef = useRef<MarkdownEditorWithMentionsRef>(null);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [activeReplyIds, setActiveReplyIds] = useState<Record<string, string>>({});
  const [replyValues, setReplyValues] = useState<Record<string, string>>({});
  const [visibleCommentsCount, setVisibleCommentsCount] = useState<Record<string, number>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [reactionBursts, setReactionBursts] = useState<Record<string, string>>({});
  const [reportDialogPostId, setReportDialogPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Attached Image States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

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
        id, content, created_at, club_id, is_pinned,
        profiles (id, full_name, handle),
        clubs (id, name, club_members (user_id, role)),
        comments (id, content, created_at, deleted_at, parent_comment_id, profiles (id, full_name, handle)),
        post_reactions (emoji, user_id)
      `,
        )
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
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
  const posts = [...allPosts].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  // Trending posts — fetched lazily only when the Trending tab is active
  const { data: trendingData, isLoading: isTrendingLoading } = useQuery<Post[]>({
    queryKey: ["trendingPosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trending_posts")
        .select(
          `
          id, content, created_at, club_id, is_pinned,
          profiles (id, full_name, handle),
          clubs (id, name, club_members (user_id, role)),
          comments (id, content, created_at, deleted_at, parent_comment_id, profiles (id, full_name, handle)),
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

  const filteredPosts = activePosts.filter((post) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();

    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;

    const contentMatch = post.content?.toLowerCase().includes(q);
    const authorMatch =
      author?.full_name?.toLowerCase().includes(q) || author?.handle?.toLowerCase().includes(q);
    const clubMatch = club?.name?.toLowerCase().includes(q);

    return contentMatch || authorMatch || clubMatch;
  });

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

  useEffect(() => {
    if (!lightboxSrc) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxSrc(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxSrc]);

  const compressImageFile = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      try {
        const worker = new CompressWorker();
        worker.postMessage({ file, width: 800, height: 600, quality: 80 });
        worker.onmessage = (e) => {
          if (e.data.success) {
            const compressedBytes = e.data.data;
            const blob = new Blob([compressedBytes], { type: "image/jpeg" });
            const compressedFile = new File([blob], file.name, { type: "image/jpeg" });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
          worker.terminate();
        };
      } catch (err) {
        console.error("Compression worker creation failed", err);
        resolve(file);
      }
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreviewUrl(URL.createObjectURL(file));
    setCompressing(true);

    try {
      const compressed = await compressImageFile(file);
      setAttachedImage(compressed);
    } catch (err) {
      console.error(err);
      setAttachedImage(file);
    } finally {
      setCompressing(false);
    }
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (!selectedClubId) throw new Error("Select a club");

      let imageUrl = null;
      if (attachedImage) {
        const filePath = `${user.id}/${crypto.randomUUID()}-${attachedImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("post-attachments")
          .upload(filePath, attachedImage);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("post-attachments").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: newPost,
        image_url: imageUrl,
      });

      if (error) throw error;

      setNewPost("");
      setAttachedImage(null);
      setImagePreviewUrl(null);
    },
    onSuccess: () => refetchPosts(),
    onError: (error) => {
      toast.error(error.message || "Failed to publish post.");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({
      postId,
      content,
      parentCommentId,
    }: {
      postId: string;
      content: string;
      parentCommentId?: string;
    }) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        content,
        parent_comment_id: parentCommentId || null,
      });
      if (error) throw error;

      if (parentCommentId) {
        setReplyValues((prev) => ({ ...prev, [parentCommentId]: "" }));
        setActiveReplyIds((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
      } else {
        setNewComments((prev) => ({ ...prev, [postId]: "" }));
      }
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

  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<string[]>([]);

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Must be logged in");
      setOptimisticDeletedIds((prev) => [...prev, postId]);
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("author_id", user.id);
      if (error) {
        setOptimisticDeletedIds((prev) => prev.filter((id) => id !== postId));
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Post deleted successfully.");
      refetchPosts();
    },
    onError: () => {
      toast.error("Failed to delete post.");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ postId, is_pinned }: { postId: string; is_pinned: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("posts").update({ is_pinned }).eq("id", postId);
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
              <MarkdownEditorWithMentions
                ref={editorRef}
                value={newPost}
                onChange={setNewPost}
                clubId={selectedClubId}
              />

              {imagePreviewUrl && (
                <div className="relative inline-block mt-2">
                  <img
                    src={imagePreviewUrl}
                    alt="Attached preview"
                    className="max-h-40 neu-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage(null);
                      setImagePreviewUrl(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 border-2 border-black hover:bg-red-600 flex items-center justify-center h-6 w-6"
                    title="Remove image"
                  >
                    <Trash2 size={12} />
                  </button>
                  {compressing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-mono text-xs">
                      Compressing...
                    </div>
                  )}
                </div>
              )}

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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={postMutation.isPending || compressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="neu-border bg-white px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-cream flex items-center gap-1.5 disabled:opacity-50"
                  >
                    📷 Attach Image
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!user) return alert("Log in first");
                      if (!emailVerified) return alert("Please verify your email to post");
                      if (!selectedClubId) return alert("Join or select a club first");
                      if (newPost.trim()) postMutation.mutate();
                    }}
                    disabled={
                      !newPost.trim() ||
                      !selectedClubId ||
                      postMutation.isPending ||
                      !emailVerified ||
                      compressing
                    }
                    title={!emailVerified ? "Please verify your email to post" : ""}
                    className={`neu-border neu-press px-5 py-2 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50 ${
                      emailVerified ? "bg-black text-cream" : "bg-gray-400 text-gray-700"
                    }`}
                  >
                    {postMutation.isPending ? "Posting…" : "Post Markdown"}
                  </button>
                </div>
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

            {/* ── Search Bar ── */}
            <div>
              <input
                type="text"
                placeholder="Search posts by content, author, or club..."
                aria-label="Search posts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-2 font-mono text-sm outline-none focus:bg-lime/10"
              />
            </div>

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
            ) : filteredPosts.length === 0 ? (
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
                    {searchQuery
                      ? "No posts match your search query."
                      : "No posts yet. Be the first to start a discussion!"}
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
                {filteredPosts.map((post: Post, index: number) => {
                  const isLastPost = feedMode === "latest" && index === filteredPosts.length - 1;
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

                  if (optimisticDeletedIds.includes(post.id)) return null;

                  const shareUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;

                  return (
                    <article
                      id={`post-${post.id}`}
                      key={post.id}
                      ref={isLastPost ? lastPostElementRef : undefined}
                      className={`neu-border p-6 ${
                        post.is_pinned ? "bg-[#FFFBEA] border-[3px] border-[#F59E0B]" : "bg-white"
                      }`}
                    >
                      {post.is_pinned && (
                        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#B45309]">
                          <Pin size={12} className="fill-[#B45309]" />
                          Pinned
                        </div>
                      )}
                      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                        <div>
                          <div className="font-display text-lg font-bold flex items-center gap-2">
                            {author?.handle ? (
                              <Link to={`/profile/${author.handle}`} className="hover:underline">
                                {author.full_name || "Unknown User"}
                              </Link>
                            ) : (
                              <span>{author?.full_name || "Unknown User"}</span>
                            )}
                            <RoleBadge role={authorRole} />
                          </div>
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
                                  pinMutation.mutate({
                                    postId: post.id,
                                    is_pinned: !post.is_pinned,
                                  })
                                }
                                disabled={pinMutation.isPending}
                                className={`neu-border neu-press flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase transition-all duration-300 cursor-pointer ${
                                  post.is_pinned
                                    ? "bg-[#FDE68A] hover:bg-[#FCD34D] text-black"
                                    : "bg-white hover:bg-cream text-black"
                                }`}
                                aria-label={post.is_pinned ? "Unpin post" : "Pin post"}
                              >
                                <Pin size={10} strokeWidth={2.5} />
                                {post.is_pinned ? "Unpin" : "Pin"}
                              </button>
                            ) : null;
                          })()}
                          {(user?.id === author?.id || userProfile?.role === "system_admin") && (
                            <button
                              type="button"
                              onClick={() => setConfirmPostId(post.id)}
                              className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 hover:bg-[#FF6B6B]"
                              aria-label="Delete post"
                            >
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </header>

                      <div className="markdown-content mt-2 font-mono text-sm leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              if (href && /youtube\.com|youtu\.be|vimeo\.com/.test(href)) {
                                return <VideoEmbed url={href} />;
                              }
                              return <a href={href}>{children}</a>;
                            },
                            img: ({ src, alt }) => (
                              <img
                                src={src}
                                alt={alt || ""}
                                onClick={() => typeof src === "string" && setLightboxSrc(src)}
                                className="max-h-64 cursor-zoom-in rounded-none neu-border"
                                loading="lazy"
                              />
                            ),
                            p: ({ children }) => (
                              <p>
                                <MentionRenderer content={String(children)} />
                              </p>
                            ),
                          }}
                        >
                          {post.content}
                        </ReactMarkdown>
                      </div>

                      {post.image_url && (
                        <div className="mt-3">
                          <img
                            src={post.image_url}
                            alt="Post attachment"
                            onClick={() => setLightboxSrc(post.image_url)}
                            className="max-h-96 cursor-zoom-in rounded-none neu-border object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

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
                                if (!emailVerified)
                                  return alert("Please verify your email to react");
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

                      <div className="mt-4 flex items-center gap-2 border-t-2 border-black pt-4">
                        <ShareMenu
                          url={shareUrl}
                          title={`Post by ${author?.full_name ?? "User"}`}
                          text={`Check out this post: ${post.content.substring(0, 50)}...`}
                        />

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(shareUrl);
                              toast.success("Link copied!");
                            } catch (err) {
                              toast.error("Failed to copy link.");
                            }
                          }}
                          className="neu-border inline-flex items-center gap-2 px-3 py-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-gray-200"
                        >
                          <Link2 size={14} />
                          Copy Link
                        </button>
                      </div>

                      <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
                        <h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase">
                          <MessageSquareText size={16} /> Comments ({postComments.length})
                        </h3>

                        <div className="space-y-4 pl-4">
                          {(() => {
                            type CommentNode = Comment & { children: CommentNode[] };

                            const buildCommentTree = (commentsList: Comment[]) => {
                              const map = new Map<string, CommentNode>();
                              commentsList.forEach((c) => map.set(c.id, { ...c, children: [] }));
                              const roots: CommentNode[] = [];
                              commentsList.forEach((c) => {
                                if (c.parent_comment_id && map.has(c.parent_comment_id)) {
                                  map.get(c.parent_comment_id)!.children.push(map.get(c.id)!);
                                } else {
                                  roots.push(map.get(c.id)!);
                                }
                              });
                              return roots;
                            };

                            const renderCommentNode = (
                              commentNode: CommentNode,
                              depth: number,
                              postId: string,
                            ) => {
                              const commentAuthor = Array.isArray(commentNode.profiles)
                                ? commentNode.profiles[0]
                                : commentNode.profiles;

                              const commentAuthorMembership = clubMembers.find(
                                (m) => m.user_id === commentAuthor?.id,
                              );

                              const indentClass = depth === 1 ? "ml-4" : depth >= 2 ? "ml-8" : "";

                              return (
                                <div key={commentNode.id} className={`${indentClass}`}>
                                  <div className="neu-border bg-cream p-3 mb-3">
                                    <div className="flex justify-between">
                                      <div className="font-mono text-xs font-bold uppercase flex items-center gap-1.5">
                                        {commentAuthor?.handle ? (
                                          <Link
                                            to={`/profile/${commentAuthor.handle}`}
                                            className="hover:underline"
                                          >
                                            {commentAuthor.full_name || "Unknown User"}
                                          </Link>
                                        ) : (
                                          <span>{commentAuthor?.full_name || "Unknown User"}</span>
                                        )}
                                        <RoleBadge
                                          role={
                                            (commentAuthorMembership?.role ??
                                              "member") as MemberRole
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-mono text-[10px] text-gray-500 dark:text-gray-300">
                                          {timeAgo(commentNode.created_at)}
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
                                                    deleteCommentMutation.mutate(commentNode.id)
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
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {commentNode.content}
                                      </ReactMarkdown>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveReplyIds((prev) => ({
                                            ...prev,
                                            [postId]: commentNode.id,
                                          }))
                                        }
                                        className="text-[10px] font-bold uppercase font-mono text-gray-500 hover:text-black cursor-pointer"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>

                                  {activeReplyIds[postId] === commentNode.id && (
                                    <div className="flex gap-2 mb-3 mt-1 pl-4 border-l-2 border-black/20">
                                      <input
                                        autoFocus
                                        value={replyValues[commentNode.id] || ""}
                                        onChange={(e) =>
                                          setReplyValues((prev) => ({
                                            ...prev,
                                            [commentNode.id]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (!user) return alert("Log in first");
                                            if (!emailVerified)
                                              return alert("Please verify your email to comment");
                                            if (replyValues[commentNode.id]?.trim()) {
                                              commentMutation.mutate({
                                                postId,
                                                content: replyValues[commentNode.id],
                                                parentCommentId: commentNode.id,
                                              });
                                            }
                                          }
                                        }}
                                        placeholder="Write a reply..."
                                        className="neu-border w-full bg-white px-3 py-2 font-mono text-sm outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveReplyIds((prev) => {
                                            const n = { ...prev };
                                            delete n[postId];
                                            return n;
                                          })
                                        }
                                        className="neu-border bg-white hover:bg-cream px-3 py-2 text-xs font-bold font-mono uppercase"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}

                                  {commentNode.children.length > 0 && (
                                    <div className="space-y-0">
                                      {commentNode.children.map((child) =>
                                        renderCommentNode(child, Math.min(depth + 1, 2), postId),
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            };

                            const roots = buildCommentTree(postComments);
                            const visibleCount =
                              visibleCommentsCount[post.id] ?? COMMENTS_PAGE_SIZE;
                            const visibleRoots = roots.slice(0, visibleCount);
                            const remaining = roots.length - visibleCount;

                            return (
                              <>
                                {visibleRoots.map((root) => renderCommentNode(root, 0, post.id))}
                                {remaining > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleCommentsCount((prev) => ({
                                        ...prev,
                                        [post.id]:
                                          (prev[post.id] ?? COMMENTS_PAGE_SIZE) +
                                          COMMENTS_PAGE_SIZE,
                                      }))
                                    }
                                    className="neu-border neu-press w-full bg-white px-3 py-2 font-mono text-xs font-bold uppercase transition-all duration-300 hover:bg-cream cursor-pointer"
                                  >
                                    Load more comments ({remaining} remaining)
                                  </button>
                                )}
                              </>
                            );
                          })()}
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
                                if (!emailVerified)
                                  return alert("Please verify your email to comment");

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
      <ConfirmModal
        open={!!confirmPostId}
        onCancel={() => setConfirmPostId(null)}
        title="Delete post?"
        description="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Yes, delete"
        onConfirm={() => {
          if (confirmPostId) deletePostMutation.mutate(confirmPostId);
          setConfirmPostId(null);
        }}
      />
    </SiteShell>
  );
}
