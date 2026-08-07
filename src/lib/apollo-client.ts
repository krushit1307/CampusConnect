import { ApolloClient, InMemoryCache, split, HttpLink } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const httpUri = import.meta.env.VITE_GRAPHQL_HTTP_URL || "http://localhost:4000/api/graphql";
const wsUri = import.meta.env.VITE_GRAPHQL_WS_URL || "ws://localhost:4000/api/graphql";

const httpLink = new HttpLink({
  uri: httpUri,
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: wsUri,
    connectionParams: async () => {
      return {};
    },
  }),
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === "OperationDefinition" && definition.operation === "subscription";
  },
  wsLink,
  httpLink,
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
