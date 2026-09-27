import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatLocalDateTime } from '../src/utils/date';

/**
 * `formatLocalDateTime` renders an instant on the LOCAL calendar (ADR 0024,
 * the session list). The failure it guards against is the one CLAUDE.md
 * names: a UTC-sliced day, which at UTC+7 files 00:00-06:59 under yesterday.
 */
let originalTz: string | undefined;
beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = 'Asia/Bangkok';
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('formatLocalDateTime', () => {
  it('puts an early-morning local instant on the local day, not the UTC one', () => {
    // 2026-09-27T23:30Z is 06:30 on the 28th in Bangkok.
    expect(formatLocalDateTime('2026-09-27T23:30:00Z')).toBe('2026-09-28 06:30');
  });

  it('returns null for something that is not a timestamp', () => {
    expect(formatLocalDateTime('not a date')).toBeNull();
  });
});
