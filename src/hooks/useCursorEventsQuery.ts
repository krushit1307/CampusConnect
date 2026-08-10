import { useInfiniteQuery } from "@tanstack/react-query";

import { GetEventsConnectionQuery, GetEventsConnectionQueryVariables } from "@/generated/graphql";

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

export { fetchGraphQL } from "@/lib/graphql-client";

/**
 * Hook to consume the GraphQL Relay-style cursor-paginated events connection API (`events(first: $first, after: $after)`).
 * Provides robust pagination against concurrent database inserts or deletes.
 */
export function useCursorEventsQuery(first: number = 10) {
  return useInfiniteQuery<
    GetEventsConnectionQuery,
    Error,
    { pages: Array<GetEventsConnectionQuery>; pageParams: Array<string | undefined> },
    unknown[],
    string | undefined
  >({
    queryKey: ["eventsConnection", first],
    queryFn: async ({ pageParam }) => {
      const variables: GetEventsConnectionQueryVariables = { first, after: pageParam };
      return fetchGraphQL<GetEventsConnectionQuery>(EVENTS_CONNECTION_QUERY, variables);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.events.pageInfo.hasNextPage
        ? (lastPage.events.pageInfo.endCursor ?? undefined)
        : undefined;
    },
  });
}
