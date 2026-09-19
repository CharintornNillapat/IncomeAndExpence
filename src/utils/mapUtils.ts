/** Builds an id -> item lookup map, replacing the `new Map(items.map(x => [x.id, x]))` shape duplicated across views/hooks. */
export function buildLookupMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
