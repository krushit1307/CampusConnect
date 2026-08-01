import { useInfiniteQuery } from "@tanstack/react-query";

export interface ProfileNode {
  id: string;
  full_name: string | null;
  handle: string | null;
  role?: string | null;
}

export interface ClubNode {
  id: string;
  name: string;
}

export interface EventNode {
  id: string;
  club_id: string;
  title: string;
  description?: string | null;
  banner_url?: string | null;
  event_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  is_private?: boolean;
  club?: ClubNode | null;
  organizer?: ProfileNode | null;
}

export interface EventEdge {
  cursor: string;
  node: EventNode;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface EventConnection {
  edges: EventEdge[];
  nodes: EventNode[];
  pageInfo: PageInfo;
  totalCount: number;
}

export const EVENTS_CONNECTION_QUERY = /* GraphQL */ `
  query GetEventsConnection($first: Int, $after: String) {
    events(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          club_id
          title
          description
          banner_url
          event_date
          start_date
          end_date
          location
          created_by
          created_at
          is_private
          club {
            id
            name
          }
          organizer {
            id
            full_name
            handle
          }
        }
      }
      nodes {
        id
        title
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export async function fetchGraphQL<TData, TVariables>(
  query: string,
  variables?: TVariables,
): Promise<TData> {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

/**
 * Hook to consume the GraphQL Relay-style cursor-paginated events connection API (`events(first: $first, after: $after)`).
 * Provides robust pagination against concurrent database inserts or deletes.
 */
export function useCursorEventsQuery(first: number = 10) {
  return useInfiniteQuery<
    { events: EventConnection },
    Error,
    { pages: Array<{ events: EventConnection }>; pageParams: Array<string | undefined> },
    unknown[],
    string | undefined
  >({
    queryKey: ["eventsConnection", first],
    queryFn: async ({ pageParam }) => {
      return fetchGraphQL<{ events: EventConnection }, { first: number; after?: string }>(
        EVENTS_CONNECTION_QUERY,
        { first, after: pageParam },
      );
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.events.pageInfo.hasNextPage
        ? (lastPage.events.pageInfo.endCursor ?? undefined)
        : undefined;
    },
  });
}
