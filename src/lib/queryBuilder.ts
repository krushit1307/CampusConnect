import type { SupabaseClient } from "@supabase/supabase-js";

export type SqlOperator =
  "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is_null" | "is_not_null";

export type FilterCondition = {
  field: string;
  operator: SqlOperator;
  value?: unknown;
};

export type FilterGroup = {
  operator: "AND" | "OR";
  conditions: Array<FilterCondition | FilterGroup>;
};

export type FilterTree = FilterCondition | FilterGroup;

export interface QueryBuilderOptions {
  table: string;
  select?: string[];
  filter?: FilterTree;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
}

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

/**
 * Validates table and column identifiers to prevent SQL injection in identifier slots.
 */
function validateIdentifier(identifier: string): string {
  const safeIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!safeIdentifierRegex.test(identifier)) {
    throw new Error(`Invalid identifier name: "${identifier}"`);
  }
  return `"${identifier}"`;
}

/**
 * Recursively builds the SQL WHERE clause and collects parameterized values.
 */
function buildWhereClause(node: FilterTree, params: unknown[]): string {
  if ("field" in node) {
    const safeField = validateIdentifier(node.field);
    const paramIndex = params.length + 1;

    switch (node.operator) {
      case "eq":
        params.push(node.value);
        return `${safeField} = $${paramIndex}`;
      case "neq":
        params.push(node.value);
        return `${safeField} != $${paramIndex}`;
      case "gt":
        params.push(node.value);
        return `${safeField} > $${paramIndex}`;
      case "gte":
        params.push(node.value);
        return `${safeField} >= $${paramIndex}`;
      case "lt":
        params.push(node.value);
        return `${safeField} < $${paramIndex}`;
      case "lte":
        params.push(node.value);
        return `${safeField} <= $${paramIndex}`;
      case "like":
        params.push(node.value);
        return `${safeField} LIKE $${paramIndex}`;
      case "ilike":
        params.push(node.value);
        return `${safeField} ILIKE $${paramIndex}`;
      case "in": {
        if (!Array.isArray(node.value) || node.value.length === 0) {
          return "1=0"; // Empty IN clause evaluates to false safely
        }
        const placeholders: string[] = [];
        for (const item of node.value) {
          params.push(item);
          placeholders.push(`$${params.length}`);
        }
        return `${safeField} IN (${placeholders.join(", ")})`;
      }
      case "is_null":
        return `${safeField} IS NULL`;
      case "is_not_null":
        return `${safeField} IS NOT NULL`;
      default:
        throw new Error("Unsupported SQL operator");
    }
  }

  if ("operator" in node && Array.isArray(node.conditions)) {
    if (node.conditions.length === 0) {
      return "1=1";
    }
    const groupOperator = node.operator === "OR" ? " OR " : " AND ";
    const clauses = node.conditions
      .map((child) => buildWhereClause(child, params))
      .filter((clause) => clause.length > 0);

    if (clauses.length === 0) return "1=1";
    return `(${clauses.join(groupOperator)})`;
  }

  throw new Error("Invalid filter node format");
}

/**
 * Builds a parameterized Postgres SQL query from options.
 */
export function buildQuery(options: QueryBuilderOptions): BuiltQuery {
  const safeTable = validateIdentifier(options.table);
  const selectCols =
    options.select && options.select.length > 0
      ? options.select.map(validateIdentifier).join(", ")
      : "*";

  let sql = `SELECT ${selectCols} FROM ${safeTable}`;
  const params: unknown[] = [];

  if (options.filter) {
    const whereClause = buildWhereClause(options.filter, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
  }

  if (options.orderBy) {
    const safeOrderCol = validateIdentifier(options.orderBy.column);
    const direction = options.orderBy.ascending === false ? "DESC" : "ASC";
    sql += ` ORDER BY ${safeOrderCol} ${direction}`;
  }

  if (typeof options.limit === "number") {
    if (options.limit < 0) throw new Error("Limit must be non-negative");
    params.push(options.limit);
    sql += ` LIMIT $${params.length}`;
  }

  if (typeof options.offset === "number") {
    if (options.offset < 0) throw new Error("Offset must be non-negative");
    params.push(options.offset);
    sql += ` OFFSET $${params.length}`;
  }

  return { sql, params };
}

/**
 * Executes the generated query via Supabase RPC execute_raw.
 */
export async function executeQuery<T = unknown>(
  supabase: SupabaseClient,
  builtQuery: BuiltQuery,
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc("execute_raw", {
      query_text: builtQuery.sql,
      query_params: builtQuery.params,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as T[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Unknown query execution error"),
    };
  }
}
