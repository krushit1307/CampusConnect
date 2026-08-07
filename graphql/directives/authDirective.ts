import { mapSchema, getDirective, MapperKind, defaultFieldResolver } from "@graphql-tools/utils";
import { GraphQLSchema, GraphQLFieldConfig, GraphQLError } from "graphql";

export type Role = "USER" | "ADMIN" | "SUPERADMIN";

interface AuthDirectiveArgs {
  requires: Role;
}

/**
 * Auth Directive Transformer
 * Wraps GraphQL resolvers to enforce role-based access control at the schema level.
 *
 * EDGE CASE HANDLING:
 * For FIELD_DEFINITION violations, this returns `null` and logs a warning instead of
 * throwing a hard error. This prevents a single unauthorized field from crashing the
 * entire GraphQL query response, avoiding partial data leaks and UI breakage.
 */
export function authDirectiveTransformer(
  schema: GraphQLSchema,
  directiveName: string = "auth",
): GraphQLSchema {
  return mapSchema(schema, {
    // Intercept Object types (e.g., if the whole type is protected)
    [MapperKind.OBJECT_TYPE]: (typeConfig) => {
      const authDirective = getDirective(schema, typeConfig, directiveName)?.[0] as
        AuthDirectiveArgs | undefined;
      if (authDirective) {
        // Wrap all fields of this object type
        const newFields = {};
        for (const fieldName in typeConfig.fields) {
          const field = typeConfig.fields[fieldName];
          newFields[fieldName] = wrapResolver(
            field,
            authDirective.requires,
            fieldName,
            typeConfig.name,
          );
        }
        return { ...typeConfig, fields: newFields };
      }
      return typeConfig;
    },

    // Intercept individual Field Definitions
    [MapperKind.OBJECT_FIELD]: (
      fieldConfig: GraphQLFieldConfig<any, any>,
      _fieldName,
      typeName,
    ) => {
      const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0] as
        AuthDirectiveArgs | undefined;
      if (authDirective) {
        return wrapResolver(fieldConfig, authDirective.requires, _fieldName, typeName);
      }
      return fieldConfig;
    },
  });
}

/**
 * Wraps the original resolver with role-checking logic.
 */
function wrapResolver(
  fieldConfig: GraphQLFieldConfig<any, any>,
  requiredRole: Role,
  fieldName: string,
  typeName: string,
): GraphQLFieldConfig<any, any> {
  const originalResolver = fieldConfig.resolve ?? defaultFieldResolver;

  fieldConfig.resolve = async function (source, args, context, info) {
    // Extract user from context (injected by auth middleware)
    const user = context?.user;

    if (!user) {
      console.warn(`[AUTH] Unauthenticated access attempt to ${typeName}.${fieldName}`);
      // For field-level, return null gracefully. For object-level, you might throw.
      return null;
    }

    const userRole = user.role as Role;
    const roleHierarchy: Record<Role, number> = { USER: 1, ADMIN: 2, SUPERADMIN: 3 };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      console.warn(
        `[AUTH] Unauthorized access: User role '${userRole}' attempted to access '${typeName}.${fieldName}' requiring '${requiredRole}'`,
      );
      // Graceful degradation: return null instead of throwing GraphQLError
      // to prevent the entire query from failing (Partial Data Leak prevention)
      return null;
    }

    // Role check passed, execute original resolver
    return originalResolver(source, args, context, info);
  };

  return fieldConfig;
}
