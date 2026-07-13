import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, PenLine, Sparkles } from "lucide-react";

import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Discussion feed — CampusConnect" },
      {
        name: "description",
        content: "Announcements, discussions, and threads across your clubs.",
      },
    ],
  }),
  component: Feed,
});

function Feed() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [newPost, setNewPost] = useState("");
  const [newComments, setNewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const { data: userClubs = [] } = useQuery({
    queryKey: ["userClubs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data } = await supabase
        .from("club_members")
        .select(
          `
          clubs (id, name)
          `,
        )
        .eq("user_id", user.id)
        .eq("status", "approved");

      return data || [];
    },
    enabled: !!user?.id,
  });

  const [selectedClubId, setSelectedClubId] = useState<string>("");

  useEffect(() => {
    if (userClubs.length > 0 && !selectedClubId) {
      const firstClub = Array.isArray(userClubs[0].clubs)
        ? userClubs[0].clubs[0]
        : userClubs[0].clubs;

      if (firstClub) setSelectedClubId(firstClub.id);
    }
  }, [userClubs, selectedClubId]);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select(
          `
          id, content, created_at,
          profiles (full_name),
          clubs (name),
          comments (id, content, created_at, profiles (full_name))
          `,
        )
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("realtime_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (!selectedClubId) throw new Error("Select a club");

      await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: newPost,
      });

      setNewPost("");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error("Must be logged in");

      await supabase.from("comments").insert({
        post_id: postId,
        author_id: user.id,
        content,
      });

      setNewComments((prev) => ({ ...prev, [postId]: "" }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
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

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow font-bold">Discussion feed</p>
          <h1 className="mt-2 text-4xl font-bold md:text-6xl">What clubs are talking about.</h1>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="neu-border bg-white p-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Post an update to your clubs... (markdown supported: **bold**, *italics*, - bullets)"
              rows={3}
              className="w-full resize-none border-0 bg-transparent font-mono text-sm outline-none"
            />

            <div className="mt-2 flex items-center justify-between border-t-2 border-black pt-3">
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="bg-transparent font-mono text-xs outline-none"
              >
                {userClubs.length === 0 && <option value="">No clubs joined</option>}
                {userClubs.map((uc) => {
                  const club = Array.isArray(uc.clubs) ? uc.clubs[0] : uc.clubs;

                  return club ? (
                    <option key={club.id} value={club.id}>
                      Posting to · {club.name}
                    </option>
                  ) : null;
                })}
              </select>

              <button
                onClick={() => {
                  if (!user) return void toast.error("Log in first");
                  if (newPost.trim()) postMutation.mutate();
                }}
                disabled={!newPost.trim() || postMutation.isPending}
                className="neu-border bg-black px-4 py-1 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 text-center font-mono">Loading feed...</div>
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
                  Share an announcement, ask a question, or post an update for your club community.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const composer = document.querySelector<HTMLTextAreaElement>(
                      'textarea[placeholder^="Post an update"]',
                    );
                    composer?.focus();
                    composer?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="neu-border mt-7 inline-flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
                >
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Start a discussion
                </button>
              </div>
            </div>
          ) : (
            posts.map((post) => {
              const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
              const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;
              const postComments = Array.isArray(post.comments) ? post.comments : [];

              return (
                <article key={post.id} className="neu-border bg-white p-6">
                  <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-black pb-3">
                    <div>
                      <p className="font-display text-lg font-bold">
                        {author?.full_name || "Unknown User"}
                      </p>
                      <p className="font-mono text-xs">
                        in {club?.name || "Unknown Club"} · {timeAgo(post.created_at)}
                      </p>
                    </div>
                    <span className="neu-border bg-lime px-2 py-1 font-mono text-[10px] font-bold uppercase">
                      Post
                    </span>
                  </header>

                  <div className="markdown-content mt-2 font-mono text-sm leading-relaxed">
                    <ReactMarkdown>{post.content}</ReactMarkdown>
                  </div>

                  <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {postComments.map((comment: any) => {
                      const commentAuthor = Array.isArray(comment.profiles)
                        ? comment.profiles[0]
                        : comment.profiles;

                      return (
                        <div key={comment.id} className="neu-border bg-cream p-3">
                          <div className="flex justify-between">
                            <p className="font-mono text-xs font-bold uppercase">
                              {commentAuthor?.full_name || "Unknown User"}
                            </p>
                            <p className="font-mono text-[10px] text-gray-500">
                              {timeAgo(comment.created_at)}
                            </p>
                          </div>
                          <div className="markdown-content mt-1 font-mono text-sm">
                            <ReactMarkdown>{comment.content}</ReactMarkdown>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex gap-2">
                      <input
                        value={newComments[post.id] || ""}
                        onChange={(e) =>
                          setNewComments((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!user) return void toast.error("Log in first");

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
            })
          )}
        </div>
      </section>
    </SiteShell>
  );
}
