/**
 * Helpers for the supabase-js select() return shapes.
 *
 * Nested selects (e.g. `select("id, profiles(full_name)")`) come back typed
 * as `T | T[] | null` because the join cardinality isn't known at compile
 * time. Every call site casts and probes — this util folds that into one
 * line:
 *
 *   const prof = unwrapNested(row.profiles);
 *   const name = prof?.full_name ?? "Clienta";
 */
export function unwrapNested<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}
