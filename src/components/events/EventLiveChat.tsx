import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import format from "date-fns/format";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Send from "lucide-react/dist/esm/icons/send";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEventLiveChat, type ChatMessage } from "@/hooks/useEventLiveChat";
import { ClubAffiliationBadges } from "@/components/ClubAffiliationBadges";

type EventLiveChatProps = {
  eventId: string;
  user: User | null;
};

function authorName(message: ChatMessage): string {
  return message.author?.full_name || message.author?.handle || "Anonymous";
}

function AuthorBadge({ message }: { message: ChatMessage }) {
  const name = authorName(message);
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black font-mono text-[10px] font-bold uppercase text-cream">
      {name.charAt(0)}
    </span>
  );
}

/**
 * Real-time live chat for an event (#2741 & #3005).
 *
 * Messages stream in over SSE (messageAdded subscription) and are sent via
 * the addMessage mutation. Executive club affiliation badges are rendered next to
 * authors' names.
 */
export function EventLiveChat({ eventId, user }: EventLiveChatProps) {
  const { messages, loading, sending, connected, error, sendMessage } = useEventLiveChat(eventId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to send a message.");
      return;
    }
    if (!draft.trim()) return;

    try {
      await sendMessage(draft);
      setDraft("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to send message.");
    }
  };

  return (
    <section aria-label="Event live chat">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight text-blue-900">
          <MessageSquare className="h-5 w-5" /> Live Chat
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase ${
            connected ? "text-green-700" : "text-black/40"
          }`}
        >
          {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      <div className="neu-border mt-4 flex flex-col bg-white dark:bg-black">
        <div
          ref={scrollRef}
          className="h-80 overflow-y-auto px-4 py-3"
          role="log"
          aria-live="polite"
          aria-label="Live chat messages"
        >
          {loading ? (
            <p className="font-mono text-xs italic text-black/40">Loading messages…</p>
          ) : error && messages.length === 0 ? (
            <p className="font-mono text-xs italic text-red-600">
              Could not load messages. Please try again later.
            </p>
          ) : messages.length === 0 ? (
            <p className="font-mono text-xs italic text-black/40">
              No messages yet. Start the conversation!
            </p>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => {
                const authorId = message.author?.id || message.userId;

                return (
                  <li key={message.id} className="flex items-start gap-3">
                    <AuthorBadge message={message} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase text-black/60">
                          {authorName(message)}
                        </span>
                        {authorId && <ClubAffiliationBadges userId={authorId} size="xs" />}
                        <span className="font-mono text-[10px] normal-case text-black/40">
                          {format(new Date(message.createdAt), "h:mm a")}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-sm leading-snug text-black dark:text-cream">
                        {message.content}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t-2 border-black/10 px-4 py-3">
          {user ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                aria-label="Chat message"
                maxLength={500}
                className="flex-1"
              />
              <Button type="submit" size="md" disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </form>
          ) : (
            <p className="font-mono text-xs font-bold text-black/50">
              Sign in to join the conversation.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
