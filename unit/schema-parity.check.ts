/**
 * The drifts `schemaOf` must refuse (Phase 100, ADR 0076). Type-only: Vitest
 * never collects this file (`*.check.ts`); the root `tsc` in `npm run lint`
 * compiles it, under `strict` since Phase 101 (ADR 0077), which the nullable
 * case needs.
 *
 * Every `@ts-expect-error` is a negative check: if `schemaOf` stopped refusing
 * that drift, the directive would be unused and `tsc` would fail on it.
 */
import { z } from 'zod';
import { schemaOf } from '../src/utils/schemaParity';

interface Row {
  id: string;
  kind: 'A' | 'B';
  note?: string;
  due?: string | null;
}

// The schema that matches: the check passes.
schemaOf<Row>()(
  z.strictObject({ id: z.string(), kind: z.enum(['A', 'B']), note: z.string().optional(), due: z.string().nullable().optional() })
);

// A field on the type that the schema does not list (a new domain field).
// @ts-expect-error schema lacks field: due
schemaOf<Row>()(z.strictObject({ id: z.string(), kind: z.enum(['A', 'B']), note: z.string().optional() }));

// A field in the schema that the type does not have.
schemaOf<Row>()(
  // @ts-expect-error type lacks field: extra
  z.strictObject({ id: z.string(), kind: z.enum(['A', 'B']), note: z.string().optional(), due: z.string().nullable().optional(), extra: z.string() })
);

// An optional field made required.
schemaOf<Row>()(
  // @ts-expect-error `note` is optional on the type
  z.strictObject({ id: z.string(), kind: z.enum(['A', 'B']), note: z.string(), due: z.string().nullable().optional() })
);

// An enum missing a member.
schemaOf<Row>()(
  // @ts-expect-error `kind` lacks 'B'
  z.strictObject({ id: z.string(), kind: z.enum(['A']), note: z.string().optional(), due: z.string().nullable().optional() })
);

// A field of the wrong type.
schemaOf<Row>()(
  // @ts-expect-error `id` is a string on the type
  z.strictObject({ id: z.number(), kind: z.enum(['A', 'B']), note: z.string().optional(), due: z.string().nullable().optional() })
);

// A field the type allows to be null, which the schema refuses (strict only).
schemaOf<Row>()(
  // @ts-expect-error `due` is nullable on the type
  z.strictObject({ id: z.string(), kind: z.enum(['A', 'B']), note: z.string().optional(), due: z.string().optional() })
);
