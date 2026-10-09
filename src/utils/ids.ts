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
  // safe-id-ignore: two random parts follow the time
  return `idemp-${Date.now()}-${rand()}-${rand()}`;
}

// A new local record's id (ADR 0095): `<prefix>-<ms>-<12 hex>`. The time keeps
// ids readable and roughly ordered; the 48 random bits keep two records made in
// the same millisecond apart (a `${Date.now()}` id alone gave both one id).
// `crypto.getRandomValues`, unlike `randomUUID`, works outside a secure
// context; Math.random covers a runtime with no `crypto` at all.
export function generateEntityId(prefix: string): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now()}-${hex}`; // safe-id-ignore: the helper itself; 48 random bits follow the time
}
