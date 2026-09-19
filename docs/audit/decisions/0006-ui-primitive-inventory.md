# 0006 — UI primitive inventory: shared components with escape-hatch overrides, not forced convergence

**Status:** Accepted
**Date:** 2026-09-19

## Context

Phases 15 and 21–28 (T22, T35, T42–T49) extracted 9 shared UI primitives and one design-token module out of duplicated-with-drift markup across the app's views and renderers. By Phase 28's own investigation (see `refactor-log.md` Phase 21/26/28 notes), nearly every extraction found that the "duplicated" call sites had already diverged from each other in some real, deliberate way — a different tint, a different padding scale, a different rounding — not just retyped the identical string. Forcing every call site through one component with one fixed appearance would have been a visual regression at whichever site didn't already match. This ADR records the inventory and the pattern used to share the component anyway: an explicit override prop for the field(s) that genuinely diverge, so the primitive still centralizes structure and behavior (markup shape, clamping, animation, ARIA) without silently repainting a site that was never asked to change.

## Inventory (as of Phase 28, commit `91687df`)

| Primitive | File | Introduced | Divergence-handling prop(s) |
|---|---|---|---|
| `Modal` | `src/components/Modal.tsx` | Phase 15 (T22) | `header` override slot (full custom chrome) alongside `title`/`subtitle` |
| `SectionHeader` | `src/components/ui/SectionHeader.tsx` | Phase 25 (T43) | `action` rendered as-is (caller supplies its own markup) |
| `Card` | `src/components/ui/Card.tsx` | Phase 25 (T44) | `padding: 'none'\|'sm'\|'md'\|'lg'` (a fixed enum, not open-ended — sites needing a 5th value stay local, see Phase 25 notes) |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.tsx` | Phase 24 (T42) | none needed — footer buttons deliberately local (`w-full` clash with a side-by-side pair) |
| `Badge` / `CategoryChip` / `categoryTint` | `src/components/ui/Badge.tsx` | Phase 26 (T45) | `CategoryChip.rounded: 'sm'\|'md'\|'full'` (3 real pre-existing values, not collapsed) |
| `ProgressMeter` | `src/components/ui/ProgressMeter.tsx` | Phase 26 (T46) | `color` (raw hex) vs `barClassName` (static Tailwind), mutually exclusive |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Phase 26 (T47) | none needed — a fixed icon/title/subtitle/action shape; callers needing chrome wrap it in `Card` themselves |
| `SegmentedControl` | `src/components/ui/SegmentedControl.tsx` | Phase 27 (T48) | `className` (tray-level display/layout only), `fill` (equal-width buttons), per-option `id` |
| `TX_TYPE_META` (design tokens) | `src/components/transaction/txTypeMeta.ts` | Phase 21 (T35) | consumers read only the fields that already match their own scheme exactly (see Phase 21 notes) |
| `TxTypeIcon` / `TxAmount` / `TxCategoryChip` / `TxSoftDeletedTag` | `src/components/transaction/TxCells.tsx` | Phase 28 (T49) | `TxTypeIcon.tintOverride`, `TxAmount.colorScheme\|colorClassName` |

Two folders, one rule: `src/components/ui/` holds generic, domain-agnostic primitives (any view could use a `Card` or a `Badge`); `src/components/transaction/` holds primitives and tokens specific to the transaction domain (`TX_TYPE_META`'s keys are `TransactionType`, not a generic enum). A new primitive goes in `ui/` unless its props are typed against a specific domain model, in which case it goes beside that domain's other files (see `wallet/` for the same precedent with `AddWalletForm`/`WalletTransferForm`).

## Options considered

**(a) Force every call site onto one fixed appearance per primitive.** Rejected repeatedly, at every phase — see the phase-specific `refactor-log.md` notes cited above. Each time this was tried in the survey pass, at least one existing call site's tint/padding/rounding/color genuinely differed, and unifying it would change what a user with no feature request sees on screen.

**(b) Fork the component per divergent site** (e.g. `CategoryChipRounded`, `CategoryChipSquare`). Rejected — this recreates the duplication the extraction was meant to remove, just one level up, and multiplies the number of things a future bug fix needs to touch.

**(c) One shared primitive per concern, with a narrow override prop for the specific field(s) already known to diverge.** Chosen, consistently, across all 9 primitives above. The override prop's default always matches the *most common* existing value (so most call sites need no prop at all), and every override is documented at its call site with why that site can't take the default — never as a silent escape hatch.

## Consequences

- Adding a 10th call site to any of these primitives should default to *not* passing the override prop. If the new site's appearance doesn't match the default, that's a signal to look at whether it's a genuine new variant (add a value to an existing enum, matching `CategoryChip.rounded`'s pattern) or a one-off (pass the override, matching `TxAmount.colorClassName`'s pattern) — not to add a new boolean flag per site.
- `TX_TYPE_META` and `TxCells.tsx`'s overrides mean **not every transaction renderer looks identical**, by design — `RecentTransactionsTable`'s Type column and amount colors, and `WalletPopupModal`'s activity-list tint, remain visually distinct from `TransactionTableRow`'s canonical scheme. Do not "fix" this convergence without reading Phase 21/28's `refactor-log.md` notes first; it was a deliberate scope boundary, not an oversight.
- `Card`'s padding enum (`none`/`sm`/`md`/`lg`) is deliberately closed. Phase 25 surveyed ~14 further candidate shells and left them local specifically because their padding didn't match any of the four values — adding a 5th value to make one more site fit is a legitimate future task, but should be done by reading which sites would actually share that 5th value, not by rubber-stamping whatever the next caller happens to need.

## Revisit if

A new transaction renderer or tab-tray switcher is added and needs a tint/color/padding value not already covered by an existing enum member or override — extend the enum (if ≥2 sites would share it) or pass a one-off override (if exactly 1 site needs it), following the precedent table above rather than inventing a new mechanism.
