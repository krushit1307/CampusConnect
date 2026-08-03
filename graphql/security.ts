import { GraphQLError, DocumentNode, Kind, OperationDefinitionNode, SelectionSetNode } from "graphql";
import type { Plugin } from "graphql-yoga";

export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 60000)
  maxMutations?: number; // Max mutation requests per window (default: 10)
}

export interface SecurityPluginOptions {
  maxDepth?: number; // Max allowed GraphQL query depth (default: 5)
  rateLimit?: RateLimitConfig;
}

/**
 * Calculates the maximum depth of a GraphQL operation AST document.
 */
export function getQueryDepth(selectionSet: SelectionSetNode, currentDepth = 1): number {
  let maxDepth = currentDepth;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.selectionSet) {
        const depth = getQueryDepth(selection.selectionSet, currentDepth + 1);
        if (depth > maxDepth) maxDepth = depth;
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT || selection.kind === Kind.FRAGMENT_SPREAD) {
      if ("selectionSet" in selection && selection.selectionSet) {
        const depth = getQueryDepth(selection.selectionSet, currentDepth);
        if (depth > maxDepth) maxDepth = depth;
      }
    }
  }

  return maxDepth;
}

// In-memory sliding window rate limiter store
const mutationStore = new Map<string, number[]>();

export function clearRateLimitStore(): void {
  mutationStore.clear();
}

/**
 * GraphQL Security Plugin for Yoga:
 * 1. Restricts query depth to prevent deeply nested recursive query attacks.
 * 2. Enforces sliding-window rate limiting on mutation operations.
 */
export function createGraphQLSecurityPlugin(options: SecurityPluginOptions = {}): Plugin {
  const maxDepth = options.maxDepth ?? 5;
  const windowMs = options.rateLimit?.windowMs ?? 60000; // 1 minute
  const maxMutations = options.rateLimit?.maxMutations ?? 10;

  return {
    onValidate({ schema, document, addValidationError }) {
      for (const definition of document.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
          const depth = getQueryDepth(definition.selectionSet, 1);
          if (depth > maxDepth) {
            addValidationError(
              new GraphQLError(
                `Query exceeds maximum allowed depth of ${maxDepth}. Current query depth is ${depth}.`,
                {
                  extensions: {
                    code: "QUERY_DEPTH_LIMIT_EXCEEDED",
                    maxDepth,
                    actualDepth: depth,
                  },
                },
              ),
            );
          }
        }
      }
    },

    onExecute({ args }) {
      const document = args.document as DocumentNode;
      const context = args.contextValue as Record<string, unknown>;

      // Check if document contains any mutation operation
      const isMutation = document.definitions.some(
        (def): def is OperationDefinitionNode =>
          def.kind === Kind.OPERATION_DEFINITION && def.operation === "mutation",
      );

      if (!isMutation) return;

      // Extract client identifier (user ID or IP)
      let identifier = "anonymous";
      if (context?.user && typeof context.user === "object" && "id" in context.user) {
        identifier = `user:${String(context.user.id)}`;
      } else if (context?.request && context.request instanceof Request) {
        const xForwardedFor = context.request.headers.get("x-forwarded-for");
        identifier = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "127.0.0.1";
      }

      const now = Date.now();
      const userTimestamps = mutationStore.get(identifier) || [];
      // Clean up timestamps outside the window
      const validTimestamps = userTimestamps.filter((ts) => now - ts < windowMs);

      if (validTimestamps.length >= maxMutations) {
        throw new GraphQLError(
          `Rate limit exceeded for GraphQL mutations. Maximum allowed is ${maxMutations} per ${
            windowMs / 1000
          } seconds. Please try again later.`,
          {
            extensions: {
              code: "RATE_LIMIT_EXCEEDED",
              http: { status: 429 },
            },
          },
        );
      }

      validTimestamps.push(now);
      mutationStore.set(identifier, validTimestamps);
    },
  };
}
