import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";
import { GraphQLSchema, defaultFieldResolver } from "graphql";
import { createGraphQLError } from "graphql-yoga";

export const authDirectiveTypeDefs = `
  enum Role {
    USER
    ADMIN
    SYSTEM_ADMIN
  }

  directive @auth(
    requires: Role = USER
  ) on OBJECT | FIELD_DEFINITION
`;

export function authDirectiveTransformer(schema: GraphQLSchema, directiveName: string = "auth") {
  return mapSchema(schema, {
    // Executes for each object field in the schema
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

      if (authDirective) {
        const { requires } = authDirective;

        // Save the original resolver
        const { resolve = defaultFieldResolver } = fieldConfig;

        // Replace the original resolver with a function that calls the original
        fieldConfig.resolve = async function (source, args, context, info) {
          const user = context.user;

          if (!user) {
            throw createGraphQLError("Not authenticated", {
              extensions: { code: "UNAUTHENTICATED" },
            });
          }

          const userRole = user.role || "USER";

          if (requires === "ADMIN" && userRole !== "ADMIN" && userRole !== "SYSTEM_ADMIN") {
            throw createGraphQLError("Not authorized", {
              extensions: { code: "UNAUTHORIZED" },
            });
          }

          if (requires === "SYSTEM_ADMIN" && userRole !== "SYSTEM_ADMIN") {
            throw createGraphQLError("Not authorized", {
              extensions: { code: "UNAUTHORIZED" },
            });
          }

          return resolve(source, args, context, info);
        };
        return fieldConfig;
      }
    },
  });
}
