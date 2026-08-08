import React from "react";
import { FeedPostSkeleton } from "@/components/FeedPostSkeleton";
import { OrganicSkeletonStudioModal } from "@/components/common/OrganicSkeletonStudioModal";
import {
  useMutation,
  useQuery,
  useInfiniteQuery,
  setQueryData,
  invalidateQueries,
} from "@/hooks/useReactQueryReplacement";
import { CommentThreadSkeleton } from "@/components/Feed/CommentSkeleton";
import { DiscussionEmptyState } from "@/components/Feed/DiscussionEmptyState";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { User } from "@supabase/supabase-js";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import {
  Link2,
  ArrowUp,
  Bookmark,
  MessageCircle,
  MessageSquareText,
  PenLine,
  Pin,
  Sparkles,
  Trash2,
  Flame,
  Flag,
  MoreVertical,
  X,
} from "lucide-react";
import { ViewToggleGroup, type FeedViewMode } from "@/components/ui/ViewToggleGroup";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { VideoEmbed } from "@/components/VideoEmbed";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedTooltip } from "@/components/ui/AnimatedTooltip";
import { toast } from "sonner";
import { RoleBadge } from "@/components/RoleBadge";
import { uploadFileWithProgress } from "@/lib/supabase/uploadFileWithProgress";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteShell } from "@/components/site/SiteShell";
import { GlobalFeedStats } from "@/components/Feed/GlobalFeedStats";
import { createClient } from "@/lib/supabase/client";
import { calculateReadTime } from "@/utils/readTime";
import {
  timeAgo,
  combinePosts,
  filterPostsBySearch,
  buildCommentTree,
  computeReaction,
} from "@/lib/feedUtils";
import { useActionQueue } from "@/store/actionQueue";
import { type CommentNode } from "@/lib/feedUtils";
import { toggleBookmark } from "@/lib/bookmarks";
import { getBlockedUserIds, filterBlockedContent } from "@/lib/userBlockUtils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { announce } from "@/store/ariaAnnouncer";
import { RelayConnection, encodeRelayCursor, decodeRelayCursor } from "@/lib/relayPagination";
import { ReportDialog } from "@/components/ReportDialog";
import { TimeAgo } from "@/components/TimeAgo";
import CompressWorker from "@/workers/compress.worker?worker";

import {
  MarkdownEditorWithMentions,
  type MarkdownEditorWithMentionsRef,
} from "@/components/MarkdownEditorWithMentions";
import { useDraft } from "@/hooks/useDraft";
import { MentionRenderer } from "@/components/MentionRenderer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LazyImage } from "@/components/ui/LazyImage";
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
  role_id: string;
  club_roles: { title: string; permissions_level: number } | null;
}

interface Club {
  id: string;
  name: string;
  club_members: ClubMember[] | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  parent_id?: string | null;
  parent_comment_id?: string | null;
  depth?: number;
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
  image_url?: string;
}

const POSTS_PER_PAGE = 20;
const COMMENTS_PAGE_SIZE = 5;

export default function Feed() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const emailVerified = useEmailVerification();
  const [newPost, setNewPost] = useState("");
  const { hasDraft, restoreDraft, discardDraft, clearSavedDraft } = useDraft(
    "feed-post-draft",
    newPost,
    setNewPost,
  );
  const editorRef = useRef<MarkdownEditorWithMentionsRef>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  const [prependedPosts, setPrependedPosts] = useState<Post[]>([]);
  const [hiddenPosts, setHiddenPosts] = useState<Post[]>([]);
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [optimisticReactions, setOptimisticReactions] = useState<
    Record<string, { countOffset: number; userReacted: boolean }>
  >({});
  const [reactionBursts, setReactionBursts] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(
    null,
  );
  const [reportReason, setReportReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Track which post comment sections are expanded; comments are fetched lazily on first expand
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  // Track per-post comment loading state (true while the first lazy fetch is in-flight)
  const [loadingCommentPostIds, setLoadingCommentPostIds] = useState<Set<string>>(new Set());
  // Cache of lazily-fetched comment threads keyed by postId
  const [lazyComments, setLazyComments] = useState<Record<string, Comment[]>>({});
  const [queuedPosts, setQueuedPosts] = useState<Post[]>([]);
  const [replyValues, setReplyValues] = useState<Record<string, string>>({});
  const [activeReplyIds, setActiveReplyIds] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});

  // Attached Image States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  // Realtime broadcast listener for deleted posts (#1297)
  useEffect(() => {
    const channel = supabase
      .channel("public:posts:delete")
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const deletedPostId = payload.old?.id;
        if (!deletedPostId) return;

        setPrependedPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
        setQueryData(["posts"], (oldData: unknown) => {
          const data = oldData as { pages?: Array<{ posts?: Post[] }> } | undefined;
          if (!data?.pages) return oldData;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              posts: page.posts?.filter((p: { id: string }) => p.id !== deletedPostId),
            })),
          };
        });
        toast.info("A post was deleted in real time");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  const [viewMode, setViewMode] = useState<FeedViewMode>("list");
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
  } = useInfiniteQuery<RelayConnection<Post>>({
    queryKey: ["posts"],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const afterCursor = pageParam as string | undefined;

      // Try get_posts_relay RPC first
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-feed?after=${afterCursor ?? ""}&first=${POSTS_PER_PAGE}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      const relayData = res.ok ? await res.json() : null;
      const relayError = res.ok ? null : new Error("get-feed request failed");
      if (!relayError && relayData && typeof relayData === "object" && "edges" in relayData) {
        const connection = relayData as unknown as RelayConnection<Post>;
        return connection;
      }

      // Fallback using get_posts_cursor
      const decoded = afterCursor ? decodeRelayCursor(afterCursor) : null;

      const { data, error } = await supabase
        .rpc("get_posts_cursor", {
          last_created_at: decoded?.createdAt || null,
          last_id: decoded?.id || null,
          fetch_limit: POSTS_PER_PAGE,
        })
        .select(
          `
        id, content, created_at, club_id, is_pinned,
        profiles (id, full_name, handle),
        clubs (id, name, club_members (user_id, role_id, club_roles (title, permissions_level))),
        comments (id),
        post_reactions (emoji, user_id)
      `,
        );

      if (error) throw error;

      const posts = (data ?? []) as unknown as Post[];
      const edges = posts.map((post) => ({
        cursor: encodeRelayCursor(post.created_at, post.id),
        node: post,
      }));

      const hasNext = posts.length === POSTS_PER_PAGE;
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
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
  });

  const allPosts = data?.pages.flatMap((page) => page.edges.map((edge) => edge.node)) ?? [];
  const posts = combinePosts(prependedPosts, allPosts);

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
          clubs (id, name, club_members (user_id, role_id, club_roles (title, permissions_level))),
          comments (id),
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

  const { data: blockedUserIds = new Set<string>() } = useQuery({
    queryKey: ["blockedUserIds", user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      return await getBlockedUserIds(user.id);
    },
    enabled: !!user?.id,
  });

  const nonBlockedPosts = filterBlockedContent(activePosts, blockedUserIds);
  const filteredPosts = filterPostsBySearch(nonBlockedPosts, searchQuery);

  const isActiveFeedLoading = feedMode === "latest" ? isLoading : isTrendingLoading;

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useWindowVirtualizer({
    count: filteredPosts.length,
    estimateSize: () => 210,
    overscan: 3,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  // Scroll position restoration (#1432)
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem("feed_scroll_position");
    if (savedScrollPos) {
      window.scrollTo(0, parseInt(savedScrollPos, 10));
    }

    const handleScrollSave = () => {
      sessionStorage.setItem("feed_scroll_position", window.scrollY.toString());
    };

    window.addEventListener("scroll", handleScrollSave, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollSave);
    };
  }, []);

  const postsRef = useRef(posts);
  const userRef = useRef(user);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const handleRefetch = useCallback(async () => {
    setShowNewPostsBanner(false);
    await refetchPosts();
  }, [refetchPosts]);

  const handleLoadNewPosts = useCallback(() => {
    setPrependedPosts((prev) => [...hiddenPosts, ...prev]);
    setHiddenPosts([]);
    setShowNewPostsBanner(false);
  }, [hiddenPosts]);

  useEffect(() => {
    const channel = supabase
      .channel("public-posts-insert")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        async (payload) => {
          const newRawPost = payload.new;
          // Ignore posts created by currently authenticated user
          if (userRef.current && newRawPost.created_by === userRef.current.id) {
            return;
          }

          // Fetch the full post with relations
          const { data, error } = await supabase
            .from("posts")
            .select(
              `
              id, content, created_at, club_id, is_pinned,
              profiles (id, full_name, handle),
              clubs (id, name, club_members (user_id, role_id, club_roles (title, permissions_level))),
              comments (id, content, created_at, deleted_at, parent_id, parent_comment_id, profiles (id, full_name, handle)),
              post_reactions (emoji, user_id)
            `,
            )
            .eq("id", newRawPost.id)
            .single();

          if (!error && data) {
            const fullPost = data as unknown as Post;
            setHiddenPosts((prev) => {
              if (prev.some((p) => p.id === fullPost.id)) return prev;
              return [fullPost, ...prev];
            });
            setShowNewPostsBanner(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  /** Fetch (or re-fetch) comments for a post and store them in lazyComments. */
  const fetchCommentsForPost = useCallback(
    async (postId: string) => {
      setLoadingCommentPostIds((ids) => new Set([...ids, postId]));
      const { data, error } = await supabase
        .from("comments")
        .select(
          `id, content, created_at, deleted_at, parent_id, parent_comment_id, profiles (id, full_name, handle)`,
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        const nonBlockedComments = filterBlockedContent(
          data as unknown as Comment[],
          blockedUserIds,
        );
        setLazyComments((prev) => ({ ...prev, [postId]: nonBlockedComments }));
      }
      setLoadingCommentPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    },
    [supabase, blockedUserIds],
  );

  const toggleComments = useCallback(
    (postId: string) => {
      setExpandedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
          fetchCommentsForPost(postId);
        }
        return next;
      });
    },
    [fetchCommentsForPost],
  );

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
    const channelName = "realtime_feed";
    // Prevent duplicate subscriptions by removing any existing channel with this topic
    supabase.getChannels().forEach((c) => {
      if (c.topic === `realtime:${channelName}` || c.topic === channelName) {
        void supabase.removeChannel(c);
      }
    });

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const isOwnPost = payload.new && payload.new.author_id === userRef.current?.id;
          const alreadyExists = postsRef.current.some((p) => p.id === payload.new.id);
          if (!isOwnPost && !alreadyExists) {
            const incomingPost = payload.new as Post;

            setQueuedPosts((prev) => {
              if (prev.some((p) => p.id === incomingPost.id)) {
                return prev;
              }

              return [incomingPost, ...prev];
            });

            setShowNewPostsBanner(true);
            announce("New post in feed");
            return;
          }
        }
        refetchPosts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) => {
        // Bust the lazy cache for the affected post so the next expand re-fetches fresh data
        const postId =
          (payload.new as { post_id?: string })?.post_id ??
          (payload.old as { post_id?: string })?.post_id;
        if (postId) {
          if (payload.eventType === "INSERT" && payload.new) {
            // Merge new comment directly into state — no full refetch needed
            setLazyComments((prev) => {
              if (!prev[postId]) return prev; // not expanded yet, skip
              return { ...prev, [postId]: [...prev[postId], payload.new as Comment] };
            });
          } else {
            // For UPDATE/DELETE bust the cache so next expand re-fetches
            setLazyComments((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => {
        refetchPosts();
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [supabase, refetchPosts]);

  // Realtime WebSocket subscriptions filtered by post_id (comments:post_id=eq.<postId>)
  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    expandedPostIds.forEach((postId) => {
      const channelName = `comments:post_id=eq.${postId}`;
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "comments",
            filter: `post_id=eq.${postId}`,
          },
          async (payload) => {
            const newRow = payload.new as {
              id: string;
              content: string;
              created_at: string;
              deleted_at?: string | null;
              author_id?: string;
              parent_id?: string | null;
              parent_comment_id?: string | null;
            };

            if (!newRow || !newRow.id) return;

            let authorProfile: Profile | null = null;
            if (newRow.author_id) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("id, full_name, handle")
                .eq("id", newRow.author_id)
                .maybeSingle();

              if (prof) {
                authorProfile = prof;
              }
            }

            const formattedComment: Comment = {
              id: newRow.id,
              content: newRow.content,
              created_at: newRow.created_at,
              deleted_at: newRow.deleted_at || null,
              parent_id: newRow.parent_id || newRow.parent_comment_id || null,
              parent_comment_id: newRow.parent_comment_id || newRow.parent_id || null,
              profiles: authorProfile,
            };

            setLazyComments((prev) => {
              const currentList = prev[postId] || [];
              if (currentList.some((c) => c.id === formattedComment.id)) {
                return prev;
              }
              return {
                ...prev,
                [postId]: [...currentList, formattedComment],
              };
            });
          },
        )
        .subscribe();

      channels.push(channel);
    });

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [expandedPostIds, supabase]);

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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Must be logged in");

        const filePath = `${user.id}/${crypto.randomUUID()}-${attachedImage.name}`;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        await uploadFileWithProgress(
          supabaseUrl,
          session.access_token,
          "post-attachments",
          filePath,
          attachedImage,
          setUploadProgress,
        );

        const {
          data: { publicUrl },
        } = supabase.storage.from("post-attachments").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: sanitizeHtml(newPost),
        image_url: imageUrl,
      });

      if (error) throw error;

      await clearSavedDraft();
      setNewPost("");
      setAttachedImage(null);
      setImagePreviewUrl(null);
    },
    onSettled: () => {
      setUploadProgress(null);
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
        parent_id: parentCommentId || null,
        parent_comment_id: parentCommentId || null,
      });
      if (error) throw error;

      if (parentCommentId) {
        setReplyValues((prev) => ({ ...prev, [parentCommentId]: "" }));
        setActiveReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(parentCommentId);
          return next;
        });
      } else {
        setNewComments((prev) => ({ ...prev, [postId]: "" }));
      }
    },
    onSuccess: (_data, variables) => {
      // The realtime subscription will merge the new comment into lazyComments.
      // Only refetch posts if the comment section for this post isn't open yet.
      if (!expandedPostIds.has(variables.postId)) {
        refetchPosts();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to publish post.");
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
    onMutate: async ({ postId, emoji, isReacted }) => {
      // Cancel any outgoing refetches
      // (not needed in this custom implementation, but kept for pattern consistency)

      // Snapshot the previous value
      const previousData = data?.pages.flatMap((page) => page.edges.map((e) => e.node)) ?? [];

      // Optimistically update the cache
      const updatedPosts = previousData.map((post) => {
        if (post.id === postId) {
          const postReactions: PostReaction[] = Array.isArray(post.post_reactions)
            ? post.post_reactions
            : [];
          if (isReacted) {
            // Remove reaction optimistically
            return {
              ...post,
              post_reactions: postReactions.filter(
                (r) => !(r.emoji === emoji && r.user_id === user?.id),
              ),
            };
          } else {
            // Add reaction optimistically
            return {
              ...post,
              post_reactions: [...postReactions, { emoji, user_id: user?.id || "" }],
            };
          }
        }
        return post;
      });

      // Update cache with optimistic data
      setQueryData(["posts"], { pages: [{ posts: updatedPosts }] });

      // Return context with previous data for rollback
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousData) {
        setQueryData(["posts"], { pages: [{ posts: context.previousData }] });
      }
      toast.error(error.message || "Failed to update reaction. Please try again.");
    },
    onSuccess: () => {
      // Refetch to ensure server state matches
      refetchPosts();
    },
  });

  const [persistedBookmarkedPostIds, setPersistedBookmarkedPostIds] = useState<Set<string>>(
    new Set(),
  );
  const [optimisticBookmarks, setOptimisticBookmarks] = useState<
    Record<string, boolean | undefined>
  >({});
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<string[]>([]);

  // Fetch which posts the user has already bookmarked
  useEffect(() => {
    if (!user) return;
    createClient()
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", user.id)
      .neq("post_id", null)
      .then(({ data }) => {
        if (data) {
          setPersistedBookmarkedPostIds(new Set(data.map((r: { post_id: string }) => r.post_id)));
        }
      });
  }, [user]);

  const bookmarkPostMutation = useMutation({
    mutationFn: async ({ postId, isBookmarked }: { postId: string; isBookmarked: boolean }) => {
      if (!user) throw new Error("Must be logged in");
      await toggleBookmark(user.id, "post", postId, isBookmarked);
    },
    onMutate: ({ postId, isBookmarked }) => {
      setOptimisticBookmarks((prev) => ({ ...prev, [postId]: !isBookmarked }));
    },
    onSuccess: (_data, { postId, isBookmarked }) => {
      toast.success(isBookmarked ? "Bookmark removed." : "Post bookmarked!");
      // Sync persisted set so state survives re-renders
      setPersistedBookmarkedPostIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });
      setOptimisticBookmarks((prev) => {
        const n = { ...prev };
        delete n[postId];
        return n;
      });
    },
    onError: (_err, { postId }) => {
      toast.error("Failed to update bookmark.");
      setOptimisticBookmarks((prev) => {
        const n = { ...prev };
        delete n[postId];
        return n;
      });
    },
  });

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

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <SiteShell>
      <div>
        <PullToRefresh onRefresh={handleRefetch} isRefreshing={isFetching}>
          <div>
            <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
              <div className="mx-auto max-w-4xl">
                <p className="eyebrow font-bold">Discussion feed</p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">
                  What clubs are talking about.
                </h1>
              </div>
            </section>
            <section className="border-b-2 border-black bg-cream px-4 py-8 md:px-6">
              <GlobalFeedStats />
            </section>

            <section className="bg-cream px-4 py-12 md:px-6">
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="space-y-3">
                  {hasDraft && (
                    <div className="neu-border flex items-center justify-between gap-3 bg-[#FFF9C4] px-4 py-2 font-mono text-xs">
                      <span className="font-bold">📝 You have an unsaved draft. Restore it?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={restoreDraft}
                          className="neu-border bg-black px-3 py-1 font-bold text-cream uppercase hover:bg-gray-800"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={discardDraft}
                          className="neu-border bg-white px-3 py-1 font-bold uppercase hover:bg-cream"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                  <MarkdownEditorWithMentions
                    ref={editorRef}
                    value={newPost}
                    onChange={setNewPost}
                    clubId={selectedClubId}
                  />

                  {imagePreviewUrl && (
                    <div className="relative mt-4 overflow-hidden neu-border w-fit max-w-full">
                      <img src={imagePreviewUrl} alt="Preview" className="max-h-96 w-auto" />
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedImage(null);
                          setImagePreviewUrl(null);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
                        disabled={postMutation.isPending}
                      >
                        <X size={16} />
                      </button>
                      {uploadProgress !== null && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2">
                          <span className="font-mono text-xs font-bold text-white mb-1 block">
                            Uploading {uploadProgress}%
                          </span>
                          <Progress value={uploadProgress} className="h-1.5" />
                        </div>
                      )}
                      {compressing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-mono text-xs">
                          Compressing...
                        </div>
                      )}
                    </div>
                  )}

                  <div className="neu-border flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <Select
                      value={selectedClubId}
                      onValueChange={setSelectedClubId}
                      disabled={userClubs.length === 0}
                    >
                      <SelectTrigger
                        className="w-full border-none bg-transparent font-mono text-xs shadow-none sm:w-auto"
                        aria-label="Choose club for post"
                      >
                        <SelectValue placeholder="No clubs joined" />
                      </SelectTrigger>
                      <SelectContent>
                        {userClubs.map((userClub) => {
                          const club = Array.isArray(userClub.clubs)
                            ? userClub.clubs[0]
                            : userClub.clubs;
                          return club ? (
                            <SelectItem key={club.id} value={club.id}>
                              Posting to · {club.name}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>

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

                      <AnimatedTooltip
                        content={!emailVerified ? "Please verify your email to post" : null}
                      >
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
                          className={`neu-border neu-press px-5 py-2 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50 ${
                            emailVerified ? "bg-black text-cream" : "bg-gray-400 text-gray-700"
                          }`}
                        >
                          {postMutation.isPending ? "Posting…" : "Post Markdown"}
                        </button>
                      </AnimatedTooltip>
                    </div>
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
                    className="flex items-center justify-between gap-2 border-b-2 border-black pb-4 dark:border-cream"
                  >
                    <ViewToggleGroup value={viewMode} onValueChange={setViewMode} />{" "}
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
                      onClick={handleLoadNewPosts}
                      style={{
                        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                      }}
                      className="neu-border flex w-full items-center justify-center gap-2 bg-[#FFD93D] hover:bg-[#FFD93D]/90 py-3 text-center font-display text-sm font-bold uppercase transition-all shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[4px_4px_0_0_#000] cursor-pointer"
                    >
                      <Sparkles size={16} className="animate-pulse" />
                      Load {hiddenPosts.length} new {hiddenPosts.length === 1 ? "post" : "posts"}
                    </button>
                  )}

                  {isActiveFeedLoading ? (
                    <div className="space-y-6">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <FeedPostSkeleton key={index} index={index} />
                      ))}
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <DiscussionEmptyState
                      searchQuery={searchQuery}
                      onStartDiscussion={() => {
                        editorRef.current?.focusWrite();
                      }}
                    />
                  ) : (
                    <div
                      ref={parentRef}
                      style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const post = filteredPosts[virtualRow.index];
                        if (!post) return null;
                        const author = Array.isArray(post.profiles)
                          ? post.profiles[0]
                          : post.profiles;
                        const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;
                        const clubMembers = Array.isArray(club?.club_members)
                          ? club.club_members
                          : club?.club_members
                            ? [club.club_members]
                            : [];

                        const authorMembership = clubMembers.find((m) => m.user_id === author?.id);

                        const authorRoleTitle =
                          authorMembership?.club_roles?.title?.toLowerCase() ?? "member";
                        const authorRole = (
                          ["admin", "organizer", "member", "alumni"].includes(authorRoleTitle)
                            ? (authorRoleTitle as MemberRole)
                            : "member"
                        ) as MemberRole;

                        const postComments: Comment[] = (
                          lazyComments[post.id] !== undefined
                            ? lazyComments[post.id]
                            : Array.isArray(post.comments)
                              ? (post.comments as Comment[])
                              : []
                        ).filter((c) => !c.deleted_at);

                        const isCommentsLoading = loadingCommentPostIds.has(post.id);
                        const isCommentsExpanded = expandedPostIds.has(post.id);

                        if (optimisticDeletedIds.includes(post.id)) return null;

                        const shareUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;

                        return (
                          <article
                            id={`post-${post.id}`}
                            key={post.id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                            }}
                            className={`neu-border p-6 ${
                              post.is_pinned
                                ? "bg-[#FFFBEA] border-[3px] border-[#F59E0B]"
                                : "bg-white"
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
                                    <Link
                                      to={`/profile/${author.handle}`}
                                      className="hover:underline"
                                    >
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
                                      (m) =>
                                        m.user_id === user?.id && m.club_roles?.title === "Admin",
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
                                {user && user.id !== author?.id && (
                                  <button
                                    type="button"
                                    onClick={() => setReportTarget({ type: "post", id: post.id })}
                                    className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 hover:bg-peach"
                                    title="Report post"
                                  >
                                    <Flag size={14} strokeWidth={2.5} />
                                  </button>
                                )}
                                {(user?.id === author?.id ||
                                  userProfile?.role === "system_admin") && (
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
                                    <LazyImage
                                      src={src}
                                      alt={alt || ""}
                                      onClick={() => typeof src === "string" && setLightboxSrc(src)}
                                      className="max-h-64 cursor-zoom-in rounded-none neu-border"
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
                                <LazyImage
                                  src={post.image_url}
                                  alt="Post attachment"
                                  onClick={() => setLightboxSrc(post.image_url ?? null)}
                                  className="max-h-96 cursor-zoom-in rounded-none neu-border object-cover"
                                />
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              {["👍", "👏", "🔥"].map((emoji) => {
                                const postReactions: PostReaction[] = Array.isArray(
                                  post.post_reactions,
                                )
                                  ? post.post_reactions
                                  : [];
                                const baseCount = postReactions.filter(
                                  (r) => r.emoji === emoji,
                                ).length;
                                const baseIsReacted = postReactions.some(
                                  (r) => r.emoji === emoji && r.user_id === user?.id,
                                );

                                const opt = optimisticReactions[`${post.id}-${emoji}`];
                                const reactionCount = opt
                                  ? Math.max(0, baseCount + opt.countOffset)
                                  : baseCount;
                                const isReacted = opt ? opt.userReacted : baseIsReacted;

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

                                      const optKey = `${post.id}-${emoji}`;
                                      setOptimisticReactions((prev) => ({
                                        ...prev,
                                        [optKey]: {
                                          countOffset: isReacted ? -1 : 1,
                                          userReacted: !isReacted,
                                        },
                                      }));

                                      setReactionBursts((prev) => ({
                                        ...prev,
                                        [burstKey]: (prev[burstKey] ?? 0) + 1,
                                      }));
                                      reactionMutation.mutate({
                                        postId: post.id,
                                        emoji,
                                        isReacted,
                                      });
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

                              {user &&
                                (() => {
                                  const persisted = persistedBookmarkedPostIds.has(post.id);
                                  const optimistic = optimisticBookmarks[post.id];
                                  const isBookmarked =
                                    optimistic !== undefined ? optimistic : persisted;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        bookmarkPostMutation.mutate({
                                          postId: post.id,
                                          isBookmarked,
                                        })
                                      }
                                      disabled={bookmarkPostMutation.isPending}
                                      aria-label={
                                        isBookmarked ? "Remove bookmark" : "Bookmark post"
                                      }
                                      className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 disabled:opacity-60"
                                    >
                                      <Bookmark
                                        className="h-4 w-4"
                                        fill={isBookmarked ? "black" : "none"}
                                      />
                                    </button>
                                  );
                                })()}
                            </div>

                            <PostComments
                              postId={post.id}
                              user={user}
                              userProfile={userProfile}
                              clubMembers={clubMembers}
                              timeAgo={timeAgo}
                            />
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {hasNextPage && feedMode === "latest" && (
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="neu-border neu-press w-full bg-white hover:bg-cream py-4 text-center font-mono text-sm font-bold uppercase transition-all shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_#000] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[4px_4px_0_0_#000] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingNextPage ? "Loading more..." : "Load More Posts"}
                    </button>
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
              </div>
            </section>
          </div>
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
        <ReportDialog
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget?.type || "post"}
          targetId={reportTarget?.id || ""}
        />
      </div>
    </SiteShell>
  );
}

interface MemoizedFeedPostProps {
  post: Post;
  virtualRow: import("@tanstack/react-virtual").VirtualItem;
  measureElement: (node: HTMLElement | null) => void;
  scrollMargin: number;
  user: User | null;
  userProfile: { role: string } | null | undefined;
  timeAgo: (dateString: string) => string;
  isPinnedPending: boolean;
  onPinToggle: (postId: string, is_pinned: boolean) => void;
  setReportTarget: (target: { type: "post" | "comment"; id: string } | null) => void;
  setConfirmPostId: (id: string | null) => void;
  setLightboxSrc: (src: string | null) => void;
  isOptimisticallyDeleted: boolean;
  emailVerified: boolean;
  onReact: (postId: string, emoji: string, isReacted: boolean) => void;
}

const MemoizedFeedPost = React.memo(
  function MemoizedFeedPost({
    post,
    virtualRow,
    measureElement,
    scrollMargin,
    user,
    userProfile,
    timeAgo,
    isPinnedPending,
    onPinToggle,
    setReportTarget,
    setConfirmPostId,
    setLightboxSrc,
    isOptimisticallyDeleted,
    emailVerified,
    onReact,
  }: MemoizedFeedPostProps) {
    const [optimisticReactions, setOptimisticReactions] = useState<
      Record<string, { countOffset: number; userReacted: boolean }>
    >({});
    const [reactionBursts, setReactionBursts] = useState<Record<string, number>>({});

    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;
    const clubMembers: ClubMember[] = Array.isArray(club?.club_members)
      ? club.club_members
      : club?.club_members
        ? [club.club_members]
        : [];

    const authorMembership = clubMembers.find((m) => m.user_id === author?.id);
    const authorRoleTitle = authorMembership?.club_roles?.title?.toLowerCase() ?? "member";
    const authorRole = (
      ["admin", "organizer", "member", "alumni"].includes(authorRoleTitle)
        ? (authorRoleTitle as MemberRole)
        : "member"
    ) as MemberRole;

    if (isOptimisticallyDeleted) return null;

    const shareUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;

    return (
      <article
        id={`post-${post.id}`}
        key={post.id}
        data-index={virtualRow.index}
        ref={measureElement}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
        }}
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
              in {club?.name || "Unknown Club"} · <TimeAgo date={post.created_at} />
              <span className="text-gray-500 dark:text-gray-300 ml-1">
                · {calculateReadTime(post.content)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const isClubAdmin =
                clubMembers.some(
                  (m) => m.user_id === user?.id && m.club_roles?.title === "Admin",
                ) || userProfile?.role === "system_admin";
              return isClubAdmin ? (
                <button
                  type="button"
                  onClick={() => onPinToggle(post.id, !post.is_pinned)}
                  disabled={isPinnedPending}
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
            {user && user.id !== author?.id && (
              <button
                type="button"
                onClick={() => setReportTarget({ type: "post", id: post.id })}
                className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 hover:bg-peach"
                title="Report post"
              >
                <Flag size={14} strokeWidth={2.5} />
              </button>
            )}
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
                <LazyImage
                  src={src}
                  alt={alt || ""}
                  onClick={() => typeof src === "string" && setLightboxSrc(src)}
                  className="max-h-64 cursor-zoom-in rounded-none neu-border"
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
            <LazyImage
              src={post.image_url}
              alt="Post attachment"
              onClick={() => setLightboxSrc(post.image_url ?? null)}
              className="max-h-96 cursor-zoom-in rounded-none neu-border object-cover"
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {["👍", "👏", "🔥"].map((emoji) => {
            const postReactions: PostReaction[] = Array.isArray(post.post_reactions)
              ? post.post_reactions
              : [];
            const baseCount = postReactions.filter((r) => r.emoji === emoji).length;
            const baseIsReacted = postReactions.some(
              (r) => r.emoji === emoji && r.user_id === user?.id,
            );

            const opt = optimisticReactions[`${post.id}-${emoji}`];
            const reactionCount = opt ? Math.max(0, baseCount + opt.countOffset) : baseCount;
            const isReacted = opt ? opt.userReacted : baseIsReacted;

            const burstKey = `${post.id}-${emoji}`;
            const burstNonce = reactionBursts[burstKey] ?? 0;

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  if (!user) return alert("Log in first");
                  if (!emailVerified) return alert("Please verify your email to react");

                  const optKey = `${post.id}-${emoji}`;
                  setOptimisticReactions((prev) => ({
                    ...prev,
                    [optKey]: {
                      countOffset: isReacted ? -1 : 1,
                      userReacted: !isReacted,
                    },
                  }));

                  setReactionBursts((prev) => ({
                    ...prev,
                    [burstKey]: (prev[burstKey] ?? 0) + 1,
                  }));
                  onReact(post.id, emoji, isReacted);
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

        <PostComments
          postId={post.id}
          user={user}
          userProfile={userProfile}
          clubMembers={clubMembers}
          timeAgo={timeAgo}
        />
      </article>
    );
  },
  (prev, next) => {
    return (
      prev.post === next.post &&
      prev.virtualRow.start === next.virtualRow.start &&
      prev.virtualRow.index === next.virtualRow.index &&
      prev.isOptimisticallyDeleted === next.isOptimisticallyDeleted &&
      prev.isPinnedPending === next.isPinnedPending &&
      prev.user?.id === next.user?.id
    );
  },
);

interface PostCommentsProps {
  postId: string;
  user: User | null;
  userProfile: { role: string } | null | undefined;
  clubMembers: { user_id: string; role: string }[];
  timeAgo: (dateString: string) => string;
}

function PostComments({ postId, user, userProfile, clubMembers, timeAgo }: PostCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [replyValues, setReplyValues] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  const supabase = createClient();

  const {
    data: comments = [],
    refetch: refetchComments,
    isLoading,
  } = useQuery<Comment[]>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comment_thread", {
        p_post_id: postId,
        p_max_depth: 10,
      });
      if (error) throw error;

      return (
        (data || []) as {
          id: string;
          post_id: string;
          author_id: string;
          author_name: string;
          content: string;
          parent_comment_id: string | null;
          created_at: string;
          deleted_at: string | null;
          depth: number;
        }[]
      ).map((c) => ({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        content: c.content,
        parent_comment_id: c.parent_comment_id,
        created_at: c.created_at,
        deleted_at: c.deleted_at,
        profiles: {
          id: c.author_id,
          full_name: c.author_name,
        },
      }));
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({
      content,
      parentCommentId,
    }: {
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
    },
    onSuccess: (_, variables) => {
      refetchComments();
      if (variables.parentCommentId) {
        setReplyValues((prev) => ({ ...prev, [variables.parentCommentId!]: "" }));
        setActiveReplyId(null);
      } else {
        setNewComment("");
      }
      toast.success("Comment added!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to post comment.");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchComments();
    },
    onError: () => {
      toast.error("Failed to delete comment.");
    },
  });

  const queuedActions = useActionQueue((state) => state.actions);
  const enqueueAction = useActionQueue((state) => state.enqueue);

  const activeComments = comments.filter((c) => !c.deleted_at && !queuedActions.has(c.id));

  const handleDeleteComment = (commentId: string) => {
    const timeoutId = setTimeout(() => {
      deleteCommentMutation.mutate(commentId);
      useActionQueue.getState().remove(commentId);
    }, 5000);

    enqueueAction({
      id: commentId,
      timeoutId,
      execute: async () => {
        deleteCommentMutation.mutate(commentId);
      },
      rollback: () => {},
    });

    toast("Comment deleted", {
      description: "The comment will be permanently deleted in 5 seconds.",
      action: {
        label: "Undo",
        onClick: () => {
          const action = useActionQueue.getState().actions.get(commentId);
          if (action) {
            clearTimeout(action.timeoutId);
            action.rollback();
            useActionQueue.getState().remove(commentId);
          }
        },
      },
    });
  };

  type CommentNode = import("@/lib/feedUtils").CommentNode;

  const renderCommentNode = (commentNode: CommentNode, depth: number) => {
    const commentAuthor = Array.isArray(commentNode.profiles)
      ? commentNode.profiles[0]
      : commentNode.profiles;

    const commentAuthorMembership = clubMembers.find((m) => m.user_id === commentAuthor?.id);
    const commentAuthorRoleTitle =
      commentAuthorMembership?.club_roles?.title?.toLowerCase() ?? "member";
    const commentAuthorRole = (
      ["admin", "organizer", "member", "alumni"].includes(commentAuthorRoleTitle)
        ? (commentAuthorRoleTitle as MemberRole)
        : "member"
    ) as MemberRole;

    const indentClass = depth === 1 ? "ml-4" : depth >= 2 ? "ml-8" : "";

    return (
      <div key={commentNode.id} className={`${indentClass}`}>
        <div className="neu-border bg-cream p-3 mb-3">
          <div className="flex justify-between">
            <p className="font-mono text-xs font-bold uppercase flex items-center gap-1.5">
              {commentAuthor?.full_name || "Unknown User"}
              <RoleBadge role={commentAuthorRole} />
            </p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] text-gray-500 dark:text-gray-300">
                <TimeAgo date={commentNode.created_at} />
              </p>
              {(user?.id === commentAuthor?.id || userProfile?.role === "system_admin") && (
                <button
                  type="button"
                  onClick={() => handleDeleteComment(commentNode.id)}
                  className="text-[#FF6B6B] hover:text-[#FF8787] uppercase font-bold font-mono text-[10px]"
                  aria-label="Delete comment"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
          <div className="markdown-content mt-1 font-mono text-sm">
            <ReactMarkdown>{commentNode.content}</ReactMarkdown>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveReplyId(commentNode.id)}
              className="text-[10px] font-bold uppercase font-mono text-gray-500 hover:text-black cursor-pointer"
            >
              Reply
            </button>
          </div>
        </div>

        {activeReplyId === commentNode.id && (
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
                  const content = replyValues[commentNode.id]?.trim();
                  if (!content) return;
                  commentMutation.mutate({
                    content,
                    parentCommentId: commentNode.id,
                  });
                }
              }}
              placeholder="Write a reply..."
              className="flex-1 border-0 border-b-2 border-black bg-transparent py-1 font-mono text-xs outline-none focus:bg-lime/10"
            />
            <button
              type="button"
              onClick={() => {
                if (!user) return alert("Log in first");
                const content = replyValues[commentNode.id]?.trim();
                if (!content) return;
                commentMutation.mutate({
                  content,
                  parentCommentId: commentNode.id,
                });
              }}
              disabled={commentMutation.isPending}
              className="neu-border bg-black text-cream px-3 py-1 font-mono text-[10px] font-bold uppercase hover:bg-cream hover:text-black"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setActiveReplyId(null)}
              className="px-2 text-xs font-bold text-gray-500 hover:text-black font-mono uppercase"
            >
              Cancel
            </button>
          </div>
        )}

        {commentNode.children.map((child) => renderCommentNode(child, depth + 1))}
      </div>
    );
  };

  const commentTree = buildCommentTree(activeComments);

  return (
    <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
      <h3 className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase">
        <MessageSquareText size={16} /> Comments ({activeComments.length})
      </h3>

      <div className="space-y-4 pl-4">
        {isLoading ? (
          <div className="text-xs font-mono text-gray-500">Loading comments...</div>
        ) : commentTree.length === 0 ? (
          <p className="font-mono text-xs text-gray-400">No comments yet.</p>
        ) : (
          commentTree.map((root) => renderCommentNode(root, 0))
        )}
      </div>

      {user && (
        <div className="flex gap-2 mt-4 pl-4">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const content = newComment.trim();
                if (!content) return;
                commentMutation.mutate({ content });
              }
            }}
            placeholder="Write a comment..."
            className="flex-1 border-0 border-b-2 border-black bg-transparent py-1.5 font-mono text-xs outline-none focus:bg-lime/10"
          />
          <button
            type="button"
            onClick={() => {
              const content = newComment.trim();
              if (!content) return;
              commentMutation.mutate({ content });
            }}
            disabled={commentMutation.isPending}
            className="neu-border bg-black text-cream px-4 py-1.5 font-mono text-xs font-bold uppercase hover:bg-cream hover:text-black"
          >
            Comment
          </button>
        </div>
      )}
    </div>
  );
}
