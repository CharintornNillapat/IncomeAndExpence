import { useCallback, useState } from 'react';

/**
 * One key armed per form. CLAUDE.md's client-idempotency convention: a failed
 * submit reuses the same key on retry (dedup, not double-spend); the key
 * rotates only after a successful write.
 */
export function useIdempotencyKey() {
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const rotateIdempotencyKey = useCallback(() => setIdempotencyKey(crypto.randomUUID()), []);
  return { idempotencyKey, rotateIdempotencyKey };
}
