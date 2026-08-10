import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  Calendar,
  Building,
  Info,
  MessageSquare,
  CheckCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import format from "date-fns/format";
import isToday from "date-fns/isToday";
import isYesterday from "date-fns/isYesterday";
import isThisWeek from "date-fns/isThisWeek";
import { SwipeToDismiss } from "@/components/ui/SwipeToDismiss";
import { useGraphQLSubscription } from "@/hooks/useGraphQLSubscription";
import {
  NotificationFilterToolbar,
  type NotificationCategory,
} from "@/components/notifications/NotificationFilterToolbar";
import { NotificationPreferenceModal } from "@/components/notifications/NotificationPreferenceModal";

const NOTIFICATION_SUBSCRIPTION = /* GraphQL */ `
  subscription NotificationReceived($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      userId
      type
      title
      message
      link
      isRead
      createdAt
      recentActors
      groupCount
      referenceId
    }
  }
`;

import {
  NotificationReceivedSubscription,
  NotificationReceivedSubscriptionVariables,
} from "@/generated/graphql";
export function getNotificationLink(
  type: string,
  metadata: Record<string, unknown> | null | undefined,
  fallbackLink?: string | null,
): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return fallbackLink || undefined;
  }

  switch (type) {
    case "event":
    case "event_rsvp":
    case "event_invite":
    case "event_update":
      if (metadata.event_id) return `/events/${metadata.event_id as string}`;
      break;
    case "club":
    case "club_application_approved":
    case "club_invite":
      if (metadata.club_id) return `/clubs/${metadata.club_id as string}`;
      break;
    case "mention":
    case "reply":
    case "post_like":
      if (metadata.post_id) {
        if (metadata.comment_id) {
          return `/posts/${metadata.post_id as string}#comment-${metadata.comment_id as string}`;
        }
        return `/posts/${metadata.post_id as string}`;
      }
      break;
    case "message":
    case "new_message":
      return "/messages";
  }
  return fallbackLink || undefined;
}

const NOTIFICATIONS_PER_PAGE = 20;

export default function NotificationsRoute() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("all");
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);

  // Resolve the authenticated user's ID for the subscription.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, [supabase.auth]);

  // ── Real-time GraphQL Subscription ──
  // Subscribes to notificationReceived(userId) via SSE when the user is known.
  const subscriptionOperation = currentUserId
    ? {
        query: NOTIFICATION_SUBSCRIPTION,
        variables: { userId: currentUserId } as NotificationReceivedSubscriptionVariables,
      }
    : null;

  const { data: subscriptionPayload, connected: subscriptionConnected } =
    useGraphQLSubscription<NotificationReceivedSubscription>(subscriptionOperation, {
      skip: !currentUserId,
    });

  // When a new notification arrives via subscription, prepend it to the
  // TanStack Query cache and show a toast so the user is immediately aware.
  const seenSubscriptionIds = useRef(new Set<string>());

  useEffect(() => {
    const notification = subscriptionPayload?.notificationReceived;
    if (!notification) return;
    // Guard against duplicate SSE frames delivering the same notification.
    if (seenSubscriptionIds.current.has(notification.id)) return;
    seenSubscriptionIds.current.add(notification.id);

    // Map GraphQL shape → DB row shape so it merges cleanly with the cached list.
    const dbRow = {
      id: notification.id,
      user_id: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      is_read: notification.isRead,
      created_at: notification.createdAt,
      metadata: notification.metadata ?? null,
      recent_actors: notification.recentActors ?? [],
      group_count: notification.groupCount ?? 1,
      reference_id: notification.referenceId ?? null,
    };

    queryClient.setQueryData(
      ["notifications"],
      (old: Parameters<typeof queryClient.setQueryData>[1]) => {
        if (!old || typeof old !== "object" || !("pages" in (old as object))) return old;
        const typedOld = old as {
          pages: Array<{ notifications: (typeof dbRow)[]; nextPage?: number }>;
          pageParams: unknown[];
        };
        return {
          ...typedOld,
          pages: typedOld.pages.map((page, i) =>
            i === 0 ? { ...page, notifications: [dbRow, ...page.notifications] } : page,
          ),
        };
      },
    );

    // Show a contextual toast for the incoming notification.
    toast.info(notification.title, {
      description: notification.message,
      duration: 5000,
    });
  }, [subscriptionPayload, queryClient]);

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ["notifications"],
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not logged in");

        const from = pageParam * NOTIFICATIONS_PER_PAGE;
        const to = from + NOTIFICATIONS_PER_PAGE - 1;

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;

        return {
          notifications: data || [],
          nextPage: data?.length === NOTIFICATIONS_PER_PAGE ? pageParam + 1 : undefined,
        };
      },
      getNextPageParam: (lastPage) => lastPage.nextPage,
    });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userData.user.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      refetch();
    },
    onError: () => toast.error("Failed to mark all as read"),
  });

  // Swipe-to-dismiss triggers this: the card is already off-screen by the
  // time this fires, so we optimistically drop it from the cache and only
  // roll back (and toast) if the delete actually fails server-side.
  const deleteNotificationMutation = useMutation<
    void,
    Error,
    string,
    { previous: ReturnType<typeof queryClient.getQueryData> }
  >({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData(["notifications"]);

      queryClient.setQueryData(["notifications"], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: page.notifications.filter((n: { id: string }) => n.id !== id),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
      toast.error("Couldn't delete that notification. Restored it.");
    },
  });

  const rawNotifications = data?.pages.flatMap((page) => page.notifications) || [];

  const actorIds = Array.from(
    new Set(rawNotifications.flatMap((n: any) => n.recent_actors || []).filter(Boolean)),
  );

  const { data: profilesMap } = useQuery({
    queryKey: ["profiles-bulk", actorIds],
    queryFn: async () => {
      if (actorIds.length === 0) return {};
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, handle")
        .in("id", actorIds);
      if (error) throw error;

      const map: Record<string, { first_name: string; last_name: string; handle: string }> = {};
      profiles?.forEach((p) => {
        map[p.id] = p;
      });
      return map;
    },
    enabled: actorIds.length > 0,
  });

  const getDynamicMessage = (n: any) => {
    if (n.type !== "post_like" || !n.recent_actors || n.recent_actors.length === 0) {
      return n.message;
    }

    const names = n.recent_actors
      .map((id: string) => {
        const p = profilesMap?.[id];
        if (p) {
          return `${p.first_name} ${p.last_name}`.trim();
        }
        return null;
      })
      .filter(Boolean);

    if (names.length === 0) {
      return n.message;
    }

    const count = n.group_count || 1;

    if (count === 1) {
      return `${names[0]} liked your post.`;
    }

    if (count === 2) {
      if (names.length >= 2) {
        return `${names[0]} and ${names[1]} liked your post.`;
      } else {
        return `${names[0]} and 1 other liked your post.`;
      }
    }

    // count > 2
    if (names.length >= 2) {
      const remaining = count - 2;
      return `${names[0]}, ${names[1]}, and ${remaining} other${remaining > 1 ? "s" : ""} liked your post.`;
    } else {
      const remaining = count - 1;
      return `${names[0]} and ${remaining} other${remaining > 1 ? "s" : ""} liked your post.`;
    }
  };

  const allNotifications = rawNotifications.filter((n) => {
    if (activeCategory === "unread" && n.is_read) return false;
    if (activeCategory === "event" && !n.type?.startsWith("event")) return false;
    if (activeCategory === "club" && !n.type?.startsWith("club")) return false;
    if (
      activeCategory === "reply" &&
      n.type !== "reply" &&
      n.type !== "mention" &&
      !n.type?.includes("like")
    )
      return false;
    if (activeCategory === "security" && n.type !== "security" && n.type !== "alert") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = n.title?.toLowerCase().includes(q);
      const messageMatch = n.message?.toLowerCase().includes(q);
      return titleMatch || messageMatch;
    }

    return true;
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = (node: HTMLElement | null) => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  };

  const groupNotifications = () => {
    const groups: Record<string, typeof allNotifications> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };

    allNotifications.forEach((n) => {
      const date = new Date(n.created_at);
      if (isToday(date)) groups.Today.push(n);
      else if (isYesterday(date)) groups.Yesterday.push(n);
      else if (isThisWeek(date)) groups["This Week"].push(n);
      else groups.Older.push(n);
    });

    return groups;
  };

  const grouped = groupNotifications();
  const unreadCount = rawNotifications.filter((n) => !n.is_read).length;
  const hasUnread = unreadCount > 0;

  const getIcon = (type: string) => {
    switch (type) {
      case "event":
      case "event_rsvp":
      case "event_invite":
      case "event_update":
        return <Calendar size={16} className="text-blue-600" />;
      case "club":
      case "club_application_approved":
      case "club_invite":
        return <Building size={16} className="text-brand-amber-base" />;
      case "reply":
      case "mention":
      case "message":
      case "new_message":
        return <MessageSquare size={16} className="text-green-600" />;
      default:
        return <Info size={16} className="text-gray-600" />;
    }
  };

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={32} strokeWidth={2.5} className="text-black" />
            <h1 className="text-3xl font-bold font-display uppercase tracking-widest text-black">
              Notifications
            </h1>
            {/* Real-time connection status badge */}
            <span
              title={
                subscriptionConnected
                  ? "Real-time updates active"
                  : "Connecting to real-time updates…"
              }
              className="flex items-center gap-1 font-mono text-xs font-bold uppercase"
            >
              {subscriptionConnected ? (
                <Wifi size={14} className="text-green-600" aria-hidden />
              ) : (
                <WifiOff size={14} className="text-gray-400 animate-pulse" aria-hidden />
              )}
            </span>
          </div>
          {hasUnread && (
            <button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="neu-border neu-press bg-lime px-4 py-2 font-mono text-xs font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
            >
              Mark All Read
            </button>
          )}
        </div>
      </section>

      <section className="bg-white px-4 py-8 md:px-6 min-h-screen">
        <div className="mx-auto max-w-3xl space-y-6">
          <NotificationFilterToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            unreadCount={unreadCount}
            onMarkAllRead={() => markAllAsReadMutation.mutate()}
            onOpenPreferences={() => setIsPrefModalOpen(true)}
          />

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-20 w-full" />
              ))}
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="text-center py-20 font-mono text-gray-500 border-2 border-dashed border-gray-300 p-8">
              No notifications matching your current filter.
            </div>
          ) : (
            Object.entries(grouped).map(([label, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={label} className="space-y-4">
                  <h2 className="font-mono text-xs font-bold uppercase text-gray-500 border-b-2 border-gray-100 pb-2">
                    {label}
                  </h2>
                  <div className="space-y-3">
                    {items.map((n, idx) => {
                      const resolvedLink = getNotificationLink(n.type, n.metadata, n.link);
                      const Wrapper = (resolvedLink ? Link : "div") as React.ElementType;
                      const wrapperProps = resolvedLink ? { to: resolvedLink } : {};
                      const isLast =
                        idx === items.length - 1 && label === Object.keys(grouped).pop();

                      return (
                        <SwipeToDismiss
                          key={n.id}
                          onDismiss={() => deleteNotificationMutation.mutate(n.id)}
                          ariaLabel={`Swipe to dismiss notification: ${n.title}`}
                        >
                          <Wrapper
                            {...wrapperProps}
                            ref={isLast ? lastElementRef : undefined}
                            className={`neu-border flex items-start gap-4 p-4 transition-all ${
                              resolvedLink ? "hover:-translate-y-1 cursor-pointer" : ""
                            } ${!n.is_read ? "bg-blue-50" : "bg-white"}`}
                          >
                            <div className="mt-1 flex-shrink-0 bg-white p-2 rounded-full border-2 border-black">
                              {getIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3
                                  className={`font-display text-base truncate ${!n.is_read ? "font-bold text-black" : "font-semibold text-gray-800"}`}
                                >
                                  {n.title}
                                </h3>
                                {!n.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 shrink-0" />
                                )}
                              </div>
                              <p className="font-mono text-sm text-gray-600 mt-1 line-clamp-2">
                                {getDynamicMessage(n)}
                              </p>
                              {n.metadata && typeof n.metadata === "object" && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {n.metadata.event_id && (
                                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase rounded">
                                      Event: {String(n.metadata.event_id).slice(0, 8)}...
                                    </span>
                                  )}
                                  {n.metadata.post_id && (
                                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold bg-green-100 text-green-700 border border-green-200 uppercase rounded">
                                      Post: {String(n.metadata.post_id).slice(0, 8)}...
                                    </span>
                                  )}
                                  {n.metadata.club_id && (
                                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase rounded">
                                      Club: {String(n.metadata.club_id).slice(0, 8)}...
                                    </span>
                                  )}
                                  {n.metadata.comment_id && (
                                    <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase rounded">
                                      Comment: {String(n.metadata.comment_id).slice(0, 8)}...
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="font-mono text-[10px] text-gray-400 mt-2">
                                {format(new Date(n.created_at), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </Wrapper>
                        </SwipeToDismiss>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          {isFetchingNextPage && (
            <div className="text-center py-4 font-mono text-xs text-gray-500">Loading more...</div>
          )}
        </div>
      </section>

      <NotificationPreferenceModal
        isOpen={isPrefModalOpen}
        onClose={() => setIsPrefModalOpen(false)}
      />
    </SiteShell>
  );
}
