/**
 * GraphQL operations for the event live chat (#2741).
 *
 * These documents are consumed by:
 *   - useEventLiveChat (initial history via `messages`)
 *   - EventLiveChat / useEventLiveChat (sending via `addMessage`)
 *   - useGraphQLSubscription (real-time delivery via `messageAdded`)
 *
 * They are also registered in codegen.ts so typescript-operations generates
 * the typed result/variable types in src/generated/graphql.ts.
 *
 * NOTE: keep the message selection inline (no template interpolation) so the
 * graphql-codegen document loader can parse these as plain GraphQL strings.
 */

export const EVENT_CHAT_MESSAGES_QUERY = /* GraphQL */ `
  query EventChatMessages($eventId: ID!, $limit: Int) {
    messages(eventId: $eventId, limit: $limit) {
      id
      eventId
      userId
      content
      createdAt
      author {
        id
        full_name
        handle
      }
    }
  }
`;

export const SEND_CHAT_MESSAGE_MUTATION = /* GraphQL */ `
  mutation SendChatMessage($eventId: ID!, $content: String!) {
    addMessage(eventId: $eventId, content: $content) {
      id
      eventId
      userId
      content
      createdAt
      author {
        id
        full_name
        handle
      }
    }
  }
`;

export const MESSAGE_ADDED_SUBSCRIPTION = /* GraphQL */ `
  subscription MessageAdded($eventId: ID!) {
    messageAdded(eventId: $eventId) {
      id
      eventId
      userId
      content
      createdAt
      author {
        id
        full_name
        handle
      }
    }
  }
`;
