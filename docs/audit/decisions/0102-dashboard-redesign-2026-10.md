# 0102: Dashboard redesign 2026-10: the existing tokens, the body only, the insights card kept, a like-for-like month comparison

**Status:** Accepted.
- **Amends** ADR 0030: replaces its block layout (`DESIGN.md`'s Dashboard table). It keeps 0030's one period for the page, every figure through a selector, and ADR 0020's insights card.
- **Implements nothing yet:** Phases 134 (selectors) and 135 (UI) build it, per the owner spec's section 6.
- **Adds** the owner spec and its mock as the redesign's authority for the Dashboard only, in place of `docs/design/finlife-redesign-spec.md` section 6.1. For every other page that spec stays the source.

**Date:** 2026-10-17

## Context

1. The owner's mock `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html` is a static, dark-only mock with sample data and raw hex colours.
2. The owner's `spec.md` in the same folder is the authority; the HTML shows layout and intent only (`spec.md:5`).
3. The shipped Dashboard is ADR 0030's.

## Decision

### D1. No new palette

The redesign uses the existing semantic tokens in both themes (light and dark). The mock's gold accent maps to the `brand` hue, its green to `income`, its coral to `expense`, its grey transfer rows to the `transfer` hue (blue in the app, not grey). No raw hex anywhere (`spec.md:9`).

Why: the semantic tokens already pass `scripts/wcag-tokens.mjs` in both themes (`DESIGN.md:57`). A darker navy-and-gold brand theme is listed as "Later, only if wanted" (`spec.md:101`), as a token change checked by that script.

### D2. Dashboard body only

The app header, nav, sync badge and Quick Add stay as they are. The mock's pill nav, Add entry button and avatar are out of scope (a later phase may take them) (`spec.md:10`).

Why: the header and nav restyle touches every page (`spec.md:100`).

### D3. The AI insights card stays

It is not in the mock, so it keeps its current behaviour and moves to the end of the page, full width. Removing it is a separate owner decision (`spec.md:11`).

Why: it is not in the mock, and removing it is a separate owner decision (`spec.md:11`).

### D4. Month comparison compares like with like

The mock compares October 1 to 16 with all of September. The real line compares day 1 to day N of this month with day 1 to day N of last month (N clamped to last month's length) (`spec.md:12`).

Why: the mock compares October 1 to 16 with all of September, which is 16 days against 30 (`spec.md:12`). N is today's day of the month, clamped to last month's length.

### D5. Every figure is computed once in DashboardView

Every figure is computed once in `DashboardView` from `src/selectors/`, as today (ADR 0030). Cards only lay out (`spec.md:13`).

Why: ADR 0030's rule, kept (`spec.md:13`).

## Consequences

- `DESIGN.md`'s Dashboard section now describes the target, with a status line saying so, until Phase 135 ships.
- `AGENTS.md` routes dashboard redesign tasks to the owner spec. The mock is read only at the lines a task names, the one exception to the `docs/design` HTML rule.
- Lines elsewhere in `DESIGN.md` that describe the shipped Dashboard are changed by the Phase 135 task that changes that code, not here: the Typography scale's "Hero number (net worth)" (`DESIGN.md:80`), "THB appears only beside the hero number" (`DESIGN.md:108`), and the Dashboard rows of "Deviations from the spec" (`DESIGN.md:333` to `:337`).
- Phase 134 adds the three selectors of the owner spec's section 5, money path, each with tests first.
