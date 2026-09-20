// Collision-resistant idempotency key. `crypto.randomUUID` is used where available;
// the fallback still mixes two independent random draws so that two submissions
// inside the same millisecond cannot produce the same key.
//
// `crypto.randomUUID` is only exposed in a secure context (HTTPS or `localhost`) -
// this repo's own `npm run dev --host=0.0.0.0` is written to be reached from a
// phone on the same LAN, which is not a secure context, so a bare
// `crypto.randomUUID()` call throws there with no error boundary to catch it.
// Every caller must go through this guarded version instead.
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `idemp-${crypto.randomUUID()}`;
  }
  const rand = () => Math.random().toString(36).slice(2, 11);
  return `idemp-${Date.now()}-${rand()}-${rand()}`;
}
