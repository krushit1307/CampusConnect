import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useInfiniteQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Bell, Calendar, Building, Info, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";

const NOTIFICATIONS_PER_PAGE = 20;

export default function NotificationsRoute() {
  const supabase = createClient();

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

  const allNotifications = data?.pages.flatMap((page) => page.notifications) || [];

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
  const hasUnread = allNotifications.some((n) => !n.is_read);

  const getIcon = (type: string) => {
    switch (type) {
      case "event":
        return <Calendar size={16} className="text-blue-600" />;
      case "club":
        return <Building size={16} className="text-brand-amber-base" />;
      case "reply":
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
        <div className="mx-auto max-w-3xl space-y-10">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-gray-200 h-20 w-full" />
              ))}
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="text-center py-20 font-mono text-gray-500">No notifications yet.</div>
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
                      const isLast =
                        idx === items.length - 1 && label === Object.keys(grouped).pop();
                      const Wrapper = (n.link ? Link : "div") as React.ElementType;
                      const wrapperProps = n.link ? { to: n.link } : {};

                      return (
                        <Wrapper
                          key={n.id}
                          {...wrapperProps}
                          ref={isLast ? lastElementRef : undefined}
                          className={`neu-border flex items-start gap-4 p-4 transition-all ${
                            n.link ? "hover:-translate-y-1 cursor-pointer" : ""
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
                              {n.message}
                            </p>
                            <p className="font-mono text-[10px] text-gray-400 mt-2">
                              {format(new Date(n.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </Wrapper>
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
    </SiteShell>
  );
}
