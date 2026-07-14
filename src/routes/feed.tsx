import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageCircle,
  MessageSquareText,
  PenLine,
  Pencil,
  Quote,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import ReactMarkdown from "react-markdown";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { calculateReadTime } from "@/utils/readTime";
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

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

type ToolbarAction = {
  label: string;
  icon: typeof Bold;
  before: string;
  after?: string;
  placeholder?: string;
  linePrefix?: boolean;
};

const toolbarActions: ToolbarAction[] = [
  { label: "Bold", icon: Bold, before: "**", after: "**", placeholder: "bold text" },
  { label: "Italic", icon: Italic, before: "*", after: "*", placeholder: "italic text" },
  { label: "Heading", icon: Heading2, before: "## ", placeholder: "Heading", linePrefix: true },
  { label: "Bulleted list", icon: List, before: "- ", placeholder: "List item", linePrefix: true },
  {
    label: "Numbered list",
    icon: ListOrdered,
    before: "1. ",
    placeholder: "List item",
    linePrefix: true,
  },
  { label: "Quote", icon: Quote, before: "> ", placeholder: "Quote", linePrefix: true },
  { label: "Inline code", icon: Code2, before: "`", after: "`", placeholder: "code" },
  {
    label: "Link",
    icon: Link2,
    before: "[",
    after: "](https://example.com)",
    placeholder: "link text",
  },
];

export type MarkdownEditorRef = {
  focusWrite: () => void;
};

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ value, onChange }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");

    useImperativeHandle(ref, () => ({
      focusWrite: () => {
        setMode("write");
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      },
    }));

    const applyMarkdown = ({
      before,
      after = "",
      placeholder = "text",
      linePrefix,
    }: ToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.slice(start, end) || placeholder;
      const prefix = linePrefix && start > 0 && value[start - 1] !== "\n" ? `\n${before}` : before;
      const replacement = `${prefix}${selectedText}${after}`;
      const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        const selectionStart = start + prefix.length;
        textarea.setSelectionRange(selectionStart, selectionStart + selectedText.length);
      });
    };

    return (
      <div className="neu-border bg-white" aria-label="Markdown post editor">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-sky p-2">
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Markdown formatting">
            {toolbarActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => applyMarkdown(action)}
                  className="neu-border bg-white p-2 transition hover:-translate-y-0.5 hover:bg-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="flex" aria-label="Editor mode">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={`neu-border flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase ${
                mode === "write" ? "bg-black text-cream" : "bg-white"
              }`}
              aria-pressed={mode === "write"}
            >
              <Pencil size={14} aria-hidden="true" /> Write
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`neu-border -ml-0.5 flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase ${
                mode === "preview" ? "bg-black text-cream" : "bg-white"
              }`}
              aria-pressed={mode === "preview"}
            >
              <Eye size={14} aria-hidden="true" /> Preview
            </button>
          </div>
        </div>

        {mode === "write" ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Share an update using Markdown…"
            rows={7}
            className="min-h-44 w-full resize-y bg-white p-4 font-mono text-sm outline-none placeholder:text-gray-500 focus:bg-cream/40"
            aria-label="Post content in Markdown"
          />
        ) : (
          <div className="min-h-44 bg-white p-4" aria-live="polite">
            {value.trim() ? (
              <div className="markdown-content font-mono text-sm leading-relaxed">
                <ReactMarkdown>{value}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center gap-2 text-center text-gray-500">
                <MessageSquareText size={32} aria-hidden="true" />
                <p className="font-mono text-sm">Your Markdown preview will appear here.</p>
              </div>
            )}
          </div>
        )}

        <div className="border-t-2 border-black bg-cream px-4 py-2 font-mono text-[10px] uppercase">
          Raw Markdown is saved. HTML is not rendered.
        </div>
      </div>
    );
  },
);
MarkdownEditor.displayName = "MarkdownEditor";

function Feed() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [newPost, setNewPost] = useState("");
  const editorRef = useRef<MarkdownEditorRef>(null);
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
        .select("clubs (id, name)")
        .eq("user_id", user.id)
        .eq("status", "approved");

      return data || [];
    },
    enabled: !!user?.id,
  });

  const [selectedClubId, setSelectedClubId] = useState("");

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
        .is("deleted_at", null)
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

      const { error } = await supabase.from("posts").insert({
        club_id: selectedClubId,
        author_id: user.id,
        content: newPost,
      });
      if (error) throw error;

      setNewPost("");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
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
                      <p className="font-mono text-xs flex flex-wrap items-center">
                        in {club?.name || "Unknown Club"} · {timeAgo(post.created_at)}
                        <span className="text-gray-500 ml-1">
                          · {calculateReadTime(post.content)}
                        </span>
                      </p>
                    </div>
                    <span className="neu-border bg-lime px-2 py-1 font-mono text-[10px] font-bold uppercase">
                      Markdown post
                    </span>
                  </header>

                  <div className="markdown-content mt-2 font-mono text-sm leading-relaxed">
                    <ReactMarkdown>{post.content}</ReactMarkdown>
                  </div>

                  <div className="mt-4 flex gap-2 border-t-2 border-black pt-4">
                    <a
                      href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors"
                    >
                      Twitter
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors"
                    >
                      LinkedIn
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Check out this post: ${post.content.substring(0, 50)}... - ${window.location.href}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors"
                    >
                      WhatsApp
                    </a>
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
            })
          )}
        </div>
      </section>
    </SiteShell>
  );
}
