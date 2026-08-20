/**
 * Read a JSON column that holds a list of strings.
 *
 * MySQL has no array type and Prisma has no scalar lists outside PostgreSQL, so the
 * handful of `String[]` columns this schema used to have are JSON arrays now. The wire
 * format is unchanged — a JSON array serialises the same either way — but the value
 * coming back from Prisma is `JsonValue`, which is anything at all.
 *
 * A row written by an older build, a failed migration or a hand-edited record can hold
 * `null`, an object, or a list with numbers in it. Every one of those becomes an empty
 * or filtered list rather than a `TypeError` three call frames later.
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}
