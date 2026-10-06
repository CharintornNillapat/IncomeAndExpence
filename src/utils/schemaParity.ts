import type { z } from 'zod';

/**
 * Type parity between a Zod schema and the type it stands for (Phase 100, ADR 0076).
 *
 * `Equal` is true only when `A` and `B` are the same type: the same fields,
 * each as optional or required, with the same member types. Assignability is
 * not enough: a schema missing an optional field, or holding an extra one, is
 * still assignable to the type.
 */
export type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;

/**
 * What `tsc` names on a mismatch: each field one side lacks, then the general
 * line, which alone means a field's type or optionality differs.
 */
type Mismatch<Out, T> = { [K in Exclude<keyof T, keyof Out> & string as `schema lacks field: ${K}`]: true } & {
  [K in Exclude<keyof Out, keyof T> & string as `type lacks field: ${K}`]: true;
} & { 'the schema does not parse to exactly this type': true };

/**
 * `schemaOf<T>()(schema)` returns `schema` unchanged and fails `tsc` unless the
 * schema parses to exactly `T`. A field added to `T` therefore fails until the
 * schema lists it too.
 *
 * Nullability is visible only under `strictNullChecks`, which both configs
 * have through `strict` since Phase 101 (ADR 0077).
 */
export const schemaOf =
  <T>() =>
  <S extends z.ZodType>(schema: S & (Equal<z.output<S>, T> extends true ? unknown : Mismatch<z.output<S>, T>)): S =>
    schema;
