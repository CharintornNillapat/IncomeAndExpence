import { useCallback, useState } from 'react';
import { generateIdempotencyKey } from '../utils/ids';

/**
 * One key armed per form. CLAUDE.md's client-idempotency convention: a failed
 * submit reuses the same key on retry (dedup, not double-spend); the key
 * rotates only after a successful write.
 */
export function useIdempotencyKey() {
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const rotateIdempotencyKey = useCallback(() => setIdempotencyKey(generateIdempotencyKey()), []);
  return { idempotencyKey, rotateIdempotencyKey };
}
