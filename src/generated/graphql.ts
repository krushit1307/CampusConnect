/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  EmailAddress: { input: unknown; output: unknown };
};

export type Club = {
  __typename?: "Club";
  id: Scalars["ID"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
};

export type Comment = {
  __typename?: "Comment";
  author?: Maybe<Profile>;
  content: Scalars["String"]["output"];
  created_at: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  post_id: Scalars["ID"]["output"];
};

export type Event = {
  __typename?: "Event";
  availableSpots?: Maybe<Scalars["Int"]["output"]>;
  available_spots?: Maybe<Scalars["Int"]["output"]>;
  banner_url?: Maybe<Scalars["String"]["output"]>;
  club?: Maybe<Club>;
  club_id: Scalars["ID"]["output"];
  created_at?: Maybe<Scalars["String"]["output"]>;
  created_by?: Maybe<Scalars["ID"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  end_date?: Maybe<Scalars["String"]["output"]>;
  event_date?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  is_private?: Maybe<Scalars["Boolean"]["output"]>;
  location?: Maybe<Scalars["String"]["output"]>;
  maxAttendees?: Maybe<Scalars["Int"]["output"]>;
  max_attendees?: Maybe<Scalars["Int"]["output"]>;
  organizer?: Maybe<Profile>;
  start_date?: Maybe<Scalars["String"]["output"]>;
  title: Scalars["String"]["output"];
  updated_at?: Maybe<Scalars["String"]["output"]>;
  version?: Maybe<Scalars["Int"]["output"]>;
};

export type EventConnection = {
  __typename?: "EventConnection";
  edges: Array<EventEdge>;
  nodes: Array<Event>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type EventEdge = {
  __typename?: "EventEdge";
  cursor: Scalars["String"]["output"];
  node: Event;
};

/**
 * A message in an event's live chat, delivered in real-time via the
 * messageAdded subscription.
 */
export type Message = {
  __typename?: "Message";
  author?: Maybe<Profile>;
  content: Scalars["String"]["output"];
  createdAt: Scalars["String"]["output"];
  eventId: Scalars["ID"]["output"];
  id: Scalars["ID"]["output"];
  userId: Scalars["ID"]["output"];
};

export type Mutation = {
  __typename?: "Mutation";
  /**
   * Send a message to an event's live chat. Persists the message and
   * publishes it to the event's Redis channel so every connected client
   * receives it via the messageAdded subscription.
   */
  addMessage: Message;
  /**
   * Manage event RSVPs with strict row-level locking (SELECT FOR UPDATE)
   * and optimistic concurrency control (version increments).
   * Prevents race conditions and overbooking.
   */
  rsvpToEvent: RsvpPayload;
  suspendUsers: Array<Profile>;
};

export type MutationAddMessageArgs = {
  content: Scalars["String"]["input"];
  eventId: Scalars["ID"]["input"];
};

export type MutationRsvpToEventArgs = {
  action?: InputMaybe<Scalars["String"]["input"]>;
  eventId: Scalars["ID"]["input"];
  userId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type MutationSuspendUsersArgs = {
  ids: Array<Scalars["ID"]["input"]>;
};

/** A notification delivered to a specific user. */
export type Notification = {
  __typename?: "Notification";
  createdAt: Scalars["String"]["output"];
  groupCount?: Maybe<Scalars["Int"]["output"]>;
  id: Scalars["ID"]["output"];
  isRead: Scalars["Boolean"]["output"];
  link?: Maybe<Scalars["String"]["output"]>;
  message: Scalars["String"]["output"];
  recentActors?: Maybe<Array<Scalars["ID"]["output"]>>;
  referenceId?: Maybe<Scalars["ID"]["output"]>;
  title: Scalars["String"]["output"];
  type: NotificationType;
  userId: Scalars["ID"]["output"];
};

/** Notification types emitted via GraphQL Subscriptions. */
export enum NotificationType {
  EventUpdate = "EVENT_UPDATE",
  Generic = "GENERIC",
  Mention = "MENTION",
}

export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]["output"]>;
  hasNextPage: Scalars["Boolean"]["output"];
  hasPreviousPage: Scalars["Boolean"]["output"];
  startCursor?: Maybe<Scalars["String"]["output"]>;
};

export type Post = {
  __typename?: "Post";
  author?: Maybe<Profile>;
  author_id: Scalars["ID"]["output"];
  club?: Maybe<Club>;
  club_id: Scalars["ID"]["output"];
  comments: Array<Comment>;
  content: Scalars["String"]["output"];
  created_at: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  pinned: Scalars["Boolean"]["output"];
};

export type PostConnection = {
  __typename?: "PostConnection";
  edges: Array<PostEdge>;
  nodes: Array<Post>;
  pageInfo: PageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type PostEdge = {
  __typename?: "PostEdge";
  cursor: Scalars["String"]["output"];
  node: Post;
};

export type Profile = {
  __typename?: "Profile";
  full_name?: Maybe<Scalars["String"]["output"]>;
  handle?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  is_banned?: Maybe<Scalars["Boolean"]["output"]>;
  role?: Maybe<Scalars["String"]["output"]>;
};

export type Query = {
  __typename?: "Query";
  allUsers: Array<Profile>;
  clubs: Array<Club>;
  event?: Maybe<Event>;
  events: EventConnection;
  /**
   * Recent messages in an event's live chat. Used to backfill history after a
   * dropped WebSocket connection.
   */
  messages: Array<Message>;
  post?: Maybe<Post>;
  posts: PostConnection;
  profiles: Array<Profile>;
  totalProfiles: Scalars["Int"]["output"];
};

export type QueryEventArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryEventsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryMessagesArgs = {
  before?: InputMaybe<Scalars["String"]["input"]>;
  eventId: Scalars["ID"]["input"];
  limit?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryPostArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryPostsArgs = {
  after?: InputMaybe<Scalars["String"]["input"]>;
  first?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryProfilesArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  sortBy?: InputMaybe<Scalars["String"]["input"]>;
  sortOrder?: InputMaybe<Scalars["String"]["input"]>;
};

/** Result payload returned by event RSVP mutation. */
export type RsvpPayload = {
  __typename?: "RsvpPayload";
  availableSpots?: Maybe<Scalars["Int"]["output"]>;
  code: Scalars["String"]["output"];
  message: Scalars["String"]["output"];
  status?: Maybe<Scalars["String"]["output"]>;
  success: Scalars["Boolean"]["output"];
  version?: Maybe<Scalars["Int"]["output"]>;
};

/**
 * Subscribe to real-time notifications for a specific user.
 * Clients receive events when they are mentioned in discussions
 * or when an event they RSVP'd to is updated.
 */
export type Subscription = {
  __typename?: "Subscription";
  /**
   * Subscribe to new messages in an event's live chat. Yields a Message for
   * every addMessage mutation published to the event's Redis channel.
   */
  messageAdded: Message;
  notificationReceived: Notification;
};

/**
 * Subscribe to real-time notifications for a specific user.
 * Clients receive events when they are mentioned in discussions
 * or when an event they RSVP'd to is updated.
 */
export type SubscriptionMessageAddedArgs = {
  eventId: Scalars["ID"]["input"];
};

/**
 * Subscribe to real-time notifications for a specific user.
 * Clients receive events when they are mentioned in discussions
 * or when an event they RSVP'd to is updated.
 */
export type SubscriptionNotificationReceivedArgs = {
  userId: Scalars["ID"]["input"];
};

/** Notification types emitted via GraphQL Subscriptions. */
export type NotificationType = "EVENT_UPDATE" | "GENERIC" | "MENTION";

export type EventChatMessagesQueryVariables = Exact<{
  eventId: string | number;
  limit?: number | null | undefined;
}>;

export type EventChatMessagesQuery = {
  messages: Array<{
    id: string;
    eventId: string;
    userId: string;
    content: string;
    createdAt: string;
    author: { id: string; full_name: string | null; handle: string | null } | null;
  }>;
};

export type SendChatMessageMutationVariables = Exact<{
  eventId: string | number;
  content: string;
}>;

export type SendChatMessageMutation = {
  addMessage: {
    id: string;
    eventId: string;
    userId: string;
    content: string;
    createdAt: string;
    author: { id: string; full_name: string | null; handle: string | null } | null;
  };
};

export type MessageAddedSubscriptionVariables = Exact<{
  eventId: string | number;
}>;

export type MessageAddedSubscription = {
  messageAdded: {
    id: string;
    eventId: string;
    userId: string;
    content: string;
    createdAt: string;
    author: { id: string; full_name: string | null; handle: string | null } | null;
  };
};

export type GetEventsConnectionQueryVariables = Exact<{
  first?: number | null | undefined;
  after?: string | null | undefined;
}>;

export type GetEventsConnectionQuery = {
  events: {
    totalCount: number;
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        club_id: string;
        title: string;
        description: string | null;
        banner_url: string | null;
        event_date: string | null;
        start_date: string | null;
        end_date: string | null;
        location: string | null;
        created_by: string | null;
        created_at: string | null;
        is_private: boolean | null;
        club: { id: string; name: string | null } | null;
        organizer: { id: string; full_name: string | null; handle: string | null } | null;
      };
    }>;
    nodes: Array<{ id: string; title: string }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
};

export type NotificationReceivedSubscriptionVariables = Exact<{
  userId: string | number;
}>;

export type NotificationReceivedSubscription = {
  notificationReceived: {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
    recentActors: Array<string> | null;
    groupCount: number | null;
    referenceId: string | null;
  };
};
