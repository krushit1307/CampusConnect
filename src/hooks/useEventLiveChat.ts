/**
 * useEventLiveChat
 *
 * Powers the event live chat (#2741):
 *   1. Backfills message history via the `messages` GraphQL query.
 *   2. Streams new messages in real-time via `messageAdded` (SSE).
 *   3. Sends messages via the `addMessage` mutation, which persists to
 *      Supabase and fans out over the Redis-backed PubSub channel.
 *
 * Uses the same conventions as the notifications feed (SSE subscription via
 * useGraphQLSubscription + fetchGraphQL for queries/mutations).
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchGraphQL } from "@/lib/graphql-client";
import { useGraphQLSubscription } from "@/hooks/useGraphQLSubscription";
import {
  EVENT_CHAT_MESSAGES_QUERY,
  SEND_CHAT_MESSAGE_MUTATION,
  MESSAGE_ADDED_SUBSCRIPTION,
} from "@/graphql/chat";
import type {
  EventChatMessagesQuery,
  MessageAddedSubscription,
  SendChatMessageMutation,
} from "@/generated/graphql";

/** A single chat message as returned by the GraphQL API. */
export type ChatMessage = EventChatMessagesQuery["messages"][number];

export interface UseEventLiveChatResult {
  /** Messages in chronological order (oldest first). */
  messages: ChatMessage[];
  /** Whether the initial history is still loading. */
  loading: boolean;
  /** Whether a send request is in flight. */
  sending: boolean;
  /** Whether the real-time subscription is connected. */
  connected: boolean;
  /** The most recent error (history load or send), if any. */
  error: Error | null;
  /** Sends a message and returns the persisted message. Throws on failure. */
  sendMessage: (content: string) => Promise<ChatMessage>;
}

/**
 * Appends a message to an existing list, deduplicating by id and keeping the
 * list sorted chronologically.
 */
export function mergeMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (messages.some((m) => m.id === incoming.id)) return messages;
  return [...messages, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function useEventLiveChat(
  eventId: string,
  options: { initialLimit?: number; endpoint?: string } = {},
): UseEventLiveChatResult {
  const { initialLimit = 50, endpoint = "/api/graphql" } = options;
  // Local/mock events have no server backend; skip all network work.
  const isMockEvent = eventId.startsWith("mock-");
  const supabase = createClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(!isMockEvent);
  const [sending, setSending] = useState(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);

  // ── 1. Initial history backfill ─────────────────────────────────────────
  useEffect(() => {
    if (isMockEvent) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchGraphQL<EventChatMessagesQuery>(EVENT_CHAT_MESSAGES_QUERY, {
      eventId,
      limit: initialLimit,
    })
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHistoryError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHistoryError(err instanceof Error ? err : new Error("Failed to load chat history"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, initialLimit, isMockEvent]);

  // ── 2. Real-time subscription ──────────────────────────────────────────
  const {
    data: subscriptionData,
    connected,
    error: subscriptionError,
  } = useGraphQLSubscription<MessageAddedSubscription>(
    isMockEvent
      ? null
      : {
          query: MESSAGE_ADDED_SUBSCRIPTION,
          variables: { eventId },
        },
    { endpoint, skip: isMockEvent },
  );

  useEffect(() => {
    const incoming = subscriptionData?.messageAdded;
    if (!incoming) return;
    setMessages((prev) => mergeMessage(prev, incoming));
  }, [subscriptionData]);

  // ── 3. Send message ────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string): Promise<ChatMessage> => {
      const text = content.trim();
      if (!text) throw new Error("Message cannot be empty");

      // Local echo for mock events so the UI still feels responsive.
      if (isMockEvent) {
        const fake: ChatMessage = {
          id: `mock-${Date.now()}`,
          eventId,
          userId: "mock-user",
          content: text,
          createdAt: new Date().toISOString(),
          author: { id: "mock-user", full_name: "You", handle: "you" },
        };
        setMessages((prev) => mergeMessage(prev, fake));
        return fake;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSending(true);
      try {
        const result = await fetchGraphQL<SendChatMessageMutation>(
          SEND_CHAT_MESSAGE_MUTATION,
          { eventId, content: text },
          {
            endpoint,
            headers: session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : undefined,
          },
        );
        const sent = result.addMessage;
        setMessages((prev) => mergeMessage(prev, sent));
        setHistoryError(null);
        return sent;
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error("Failed to send message");
        setHistoryError(wrapped);
        throw wrapped;
      } finally {
        setSending(false);
      }
    },
    [eventId, endpoint, isMockEvent, supabase],
  );

  const error = historyError ?? (subscriptionError ? new Error(subscriptionError.message) : null);

  return { messages, loading, sending, connected, error, sendMessage };
}
