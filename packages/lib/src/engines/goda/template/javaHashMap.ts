/**
 * The order a `java.util.HashMap<String, …>` iterates its keys in, where
 * GODA writes one out (PARAMProducer's `ctxInformation`): by bucket
 * (`String.hashCode`, spread as `h ^ h >>> 16`, masked by the table's
 * size), then in the order the keys went into the bucket. The table starts
 * at 16 and doubles past three quarters full; a resize keeps each bucket's
 * order. (Buckets turned into trees, past 8 keys in one bucket of a table of
 * 64 or more, are not modelled.)
 */

/** Java's `String.hashCode`, over UTF-16 code units. */
const hashCode = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1)
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  return hash;
};

/** The keys, in their first insertion order, as a HashMap iterates them. */
export const javaHashMapOrder = (keys: readonly string[]): string[] => {
  const unique = [...new Set(keys)];
  let capacity = 16;
  while (unique.length > capacity * 0.75) capacity *= 2;
  const bucket = (key: string) => {
    const h = hashCode(key);
    return (h ^ (h >>> 16)) & (capacity - 1);
  };
  return unique
    .map((key, order) => ({ key, order, bucket: bucket(key) }))
    .sort((a, b) => a.bucket - b.bucket || a.order - b.order)
    .map(({ key }) => key);
};
