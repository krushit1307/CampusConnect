/**
 * Custom Conflict Resolution Algorithm & Differential Sync Engine for Event Editing
 *
 * Tailored for complex nested event JSON schemas using 3-Way Differential Merging and Version Vectors.
 */

export type VersionVector = Record<string, number>;

export interface EventDocument {
  id?: string;
  title: string;
  description: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  version_vector?: VersionVector;
  version?: number;
  [key: string]: unknown;
}

export interface FieldConflict {
  field: string;
  baseValue: unknown;
  localValue: unknown;
  serverValue: unknown;
}

export interface MergeResult<T = EventDocument> {
  mergedDocument: T;
  hasConflicts: boolean;
  conflicts: FieldConflict[];
}

/**
 * Compares two Version Vectors to determine causality relationship.
 */
export function compareVersionVectors(
  v1: VersionVector = {},
  v2: VersionVector = {},
): "EQUAL" | "DOMINATES" | "SUBORDINATE" | "CONCURRENT" {
  const keys = Array.from(new Set([...Object.keys(v1), ...Object.keys(v2)]));
  let v1Greater = false;
  let v2Greater = false;

  for (const key of keys) {
    const val1 = v1[key] || 0;
    const val2 = v2[key] || 0;

    if (val1 > val2) v1Greater = true;
    if (val2 > val1) v2Greater = true;
  }

  if (!v1Greater && !v2Greater) return "EQUAL";
  if (v1Greater && !v2Greater) return "DOMINATES";
  if (!v1Greater && v2Greater) return "SUBORDINATE";
  return "CONCURRENT";
}

/**
 * Increments the version counter for a given client ID in a Version Vector.
 */
export function incrementVersionVector(
  vector: VersionVector = {},
  clientId: string,
): VersionVector {
  const currentSeq = vector[clientId] || 0;
  return {
    ...vector,
    [clientId]: currentSeq + 1,
  };
}

/**
 * Helper to check deep equality between two values.
 */
export function isDeepEqual(val1: unknown, val2: unknown): boolean {
  if (val1 === val2) return true;
  if (val1 == null || val2 == null) return val1 === val2;
  if (typeof val1 !== typeof val2) return false;

  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    return val1.every((item, index) => isDeepEqual(item, val2[index]));
  }

  if (typeof val1 === "object") {
    const obj1 = val1 as Record<string, unknown>;
    const obj2 = val2 as Record<string, unknown>;
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;
    return keys1.every((key) => isDeepEqual(obj1[key], obj2[key]));
  }

  return false;
}

/**
 * Performs a 3-way array merge (LWW-Element-Set) preserving additions from both sources
 * while respecting deletions relative to the base snapshot.
 */
export function mergeArrays<T>(base: T[] = [], local: T[] = [], server: T[] = []): T[] {
  const baseSet = new Set(base);
  const localSet = new Set(local);
  const serverSet = new Set(server);

  // Items added by local or server
  const localAdded = local.filter((item) => !baseSet.has(item));
  const serverAdded = server.filter((item) => !baseSet.has(item));

  // Items deleted by local or server
  const localDeleted = new Set(base.filter((item) => !localSet.has(item)));
  const serverDeleted = new Set(base.filter((item) => !serverSet.has(item)));

  // Combine items: keep base items unless deleted by either local or server, plus all additions
  const merged: T[] = [];

  for (const item of base) {
    if (!localDeleted.has(item) && !serverDeleted.has(item)) {
      merged.push(item);
    }
  }

  for (const item of localAdded) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }

  for (const item of serverAdded) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Recursively performs a 3-way object merge for nested JSON data.
 */
export function mergeObjects(
  base: Record<string, unknown> = {},
  local: Record<string, unknown> = {},
  server: Record<string, unknown> = {},
  pathPrefix = "",
): { merged: Record<string, unknown>; conflicts: FieldConflict[] } {
  const allKeys = Array.from(
    new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)]),
  );
  const merged: Record<string, unknown> = {};
  const conflicts: FieldConflict[] = [];

  for (const key of allKeys) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const baseVal = base[key];
    const localVal = local[key];
    const serverVal = server[key];

    // Case 1: All equal
    if (isDeepEqual(localVal, serverVal)) {
      if (localVal !== undefined) merged[key] = localVal;
      continue;
    }

    // Case 2: Only local changed
    if (isDeepEqual(serverVal, baseVal)) {
      if (localVal !== undefined) merged[key] = localVal;
      continue;
    }

    // Case 3: Only server changed
    if (isDeepEqual(localVal, baseVal)) {
      if (serverVal !== undefined) merged[key] = serverVal;
      continue;
    }

    // Case 4: Arrays -> Perform 3-way array merge
    if (Array.isArray(localVal) || Array.isArray(serverVal) || Array.isArray(baseVal)) {
      const baseArr = Array.isArray(baseVal) ? baseVal : [];
      const localArr = Array.isArray(localVal) ? localVal : [];
      const serverArr = Array.isArray(serverVal) ? serverVal : [];
      merged[key] = mergeArrays(baseArr, localArr, serverArr);
      continue;
    }

    // Case 5: Nested objects -> Recursive merge
    if (
      typeof localVal === "object" &&
      localVal !== null &&
      typeof serverVal === "object" &&
      serverVal !== null
    ) {
      const baseObj = (typeof baseVal === "object" && baseVal !== null ? baseVal : {}) as Record<
        string,
        unknown
      >;
      const childResult = mergeObjects(
        baseObj,
        localVal as Record<string, unknown>,
        serverVal as Record<string, unknown>,
        fullPath,
      );
      merged[key] = childResult.merged;
      conflicts.push(...childResult.conflicts);
      continue;
    }

    // Case 6: Both changed to different values -> Unresolvable Field Conflict
    conflicts.push({
      field: fullPath,
      baseValue: baseVal,
      localValue: localVal,
      serverValue: serverVal,
    });
    // Default to local value pending manual resolution
    if (localVal !== undefined) merged[key] = localVal;
  }

  return { merged, conflicts };
}

/**
 * Main 3-way differential conflict resolution engine for event documents.
 */
export function mergeEventDocuments(
  base: EventDocument,
  local: EventDocument,
  server: EventDocument,
  clientId = "local-client",
): MergeResult {
  const baseRecord = base as Record<string, unknown>;
  const localRecord = local as Record<string, unknown>;
  const serverRecord = server as Record<string, unknown>;

  const { merged, conflicts } = mergeObjects(baseRecord, localRecord, serverRecord);

  // Update version vector
  const baseVector = server.version_vector || base.version_vector || {};
  const newVector = incrementVersionVector(baseVector, clientId);
  merged.version_vector = newVector;
  merged.version = (server.version || base.version || 1) + 1;

  return {
    mergedDocument: merged as EventDocument,
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}
