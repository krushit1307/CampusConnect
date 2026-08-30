// =============================================================================
// Contracts: WebSocket JSON Schemas (Zod)
// Issue: #2410 - Exhaustive Contract Tests for WebSocket / Socket.io JSON schemas
// Description: Strict Zod schemas defining the exact payload structure expected
// by the frontend for all WebSocket events. Prevents silent UI breaks when
// backend developers rename fields.
// =============================================================================

import { z } from "zod";

/**
 * Schema for chat_message event payload
 * Emitted when a user sends a direct message or group chat message
 */
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(2000),
  author: z.string().uuid(), // CRITICAL: Must be 'author', not 'userId'
  timestamp: z.string().datetime(),
  roomId: z.string().uuid(),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["image", "video", "document"]),
        name: z.string(),
      }),
    )
    .optional(),
  replyTo: z.string().uuid().nullable().optional(),
});

export type ChatMessagePayload = z.infer<typeof ChatMessageSchema>;

/**
 * Schema for typing_indicator event payload
 * Emitted when a user starts/stops typing in a chat room
 */
export const TypingIndicatorSchema = z.object({
  userId: z.string().uuid(),
  roomId: z.string().uuid(),
  isTyping: z.boolean(),
  timestamp: z.string().datetime(),
});

export type TypingIndicatorPayload = z.infer<typeof TypingIndicatorSchema>;

/**
 * Schema for user_joined event payload
 * Emitted when a user joins a club or event room
 */
export const UserJoinedSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().min(1).max(50),
  avatarUrl: z.string().url().nullable(),
  roomId: z.string().uuid(),
  joinedAt: z.string().datetime(),
});

export type UserJoinedPayload = z.infer<typeof UserJoinedSchema>;

/**
 * Schema for user_left event payload
 * Emitted when a user leaves a room or disconnects
 */
export const UserLeftSchema = z.object({
  userId: z.string().uuid(),
  roomId: z.string().uuid(),
  leftAt: z.string().datetime(),
  reason: z.enum(["voluntary", "disconnect", "kicked"]).optional(),
});

export type UserLeftPayload = z.infer<typeof UserLeftSchema>;

/**
 * Schema for event_update event payload
 * Emitted when event details change in real-time
 */
export const EventUpdateSchema = z.object({
  eventId: z.string().uuid(),
  field: z.enum(["title", "description", "date", "location", "status"]),
  oldValue: z.any(),
  newValue: z.any(),
  updatedBy: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export type EventUpdatePayload = z.infer<typeof EventUpdateSchema>;

/**
 * Schema for attendee_sentiment_submit event payload (Issue #5128)
 * Emitted when an event attendee moves the Engagement Meter slider
 */
export const AttendeeSentimentSubmitSchema = z.object({
  eventId: z.string().min(1),
  attendeeId: z.string().min(1),
  sentiment: z.number().min(0).max(100),
  timestamp: z.string().optional(),
});

export type AttendeeSentimentSubmitPayload = z.infer<typeof AttendeeSentimentSubmitSchema>;

/**
 * Schema for presenter_sentiment_aggregate event payload (Issue #5128)
 * Broadcast every 5 seconds to authorized presenters with crowd aggregate percentage
 */
export const PresenterSentimentAggregateSchema = z.object({
  eventId: z.string().min(1),
  engagement: z.number().min(0).max(100),
  status: z.enum(["healthy", "low"]),
  activeCount: z.number().min(0),
  timestamp: z.string(),
});

export type PresenterSentimentAggregatePayload = z.infer<typeof PresenterSentimentAggregateSchema>;

/**
 * Schema for jury_duty_notification event payload (Issue #5129)
 * Emitted when a user is randomly selected for Jury Duty
 */
export const JuryDutyNotificationSchema = z.object({
  caseId: z.string().min(1),
  jurorId: z.string().min(1),
  reason: z.string(),
  assignedAt: z.string(),
});

export type JuryDutyNotificationPayload = z.infer<typeof JuryDutyNotificationSchema>;

/**
 * Schema for jury_case_update event payload (Issue #5129)
 * Emitted when a jury case reaches 4-of-5 consensus resolution
 */
export const JuryCaseUpdateSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "ASSIGNED",
    "VOTING",
    "RESOLVED_VIOLATION",
    "RESOLVED_FINE",
    "EXPIRED",
  ]),
  consensusDecision: z.enum(["violates_policy", "looks_fine"]).nullable().optional(),
  resolvedAt: z.string().optional(),
});

export type JuryCaseUpdatePayload = z.infer<typeof JuryCaseUpdateSchema>;

/**
 * Master registry of all WebSocket event contracts
 * Used by both backend emission and frontend validation
 */
export const WebSocketContracts = {
  chat_message: ChatMessageSchema,
  typing_indicator: TypingIndicatorSchema,
  user_joined: UserJoinedSchema,
  user_left: UserLeftSchema,
  event_update: EventUpdateSchema,
  attendee_sentiment_submit: AttendeeSentimentSubmitSchema,
  presenter_sentiment_aggregate: PresenterSentimentAggregateSchema,
  jury_duty_notification: JuryDutyNotificationSchema,
  jury_case_update: JuryCaseUpdateSchema,
} as const;

export type WebSocketEventName = keyof typeof WebSocketContracts;

/**
 * Type-safe validation helper for incoming WebSocket payloads
 */
export function validateWebSocketPayload<T extends WebSocketEventName>(
  eventName: T,
  payload: unknown,
): z.infer<(typeof WebSocketContracts)[T]> {
  const schema = WebSocketContracts[eventName];
  return schema.parse(payload) as z.infer<(typeof WebSocketContracts)[T]>;
}
