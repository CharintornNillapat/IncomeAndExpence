# 0060: CI traces a first failure without the screencast; nothing moves while the app loads

**Status:** Accepted. Implemented on branch `phase-84-ci-trace-opt-and-cls` (commit `9348b0d`), draft PR. Not merged yet.
- **Amends** ADR `0059`'s CI trace: same mode, without screenshots.

**Date:** 2026-10-05

## Context

### The trace cost

ADR `0059` made CI record a trace of every test's first attempt (`retain-on-first-failure`) and keep it when that attempt fails. On the two CI runs since, WebKit's E2E job took 4.5 m both times, against 3.6 and 3.8 m on the two `main` runs before it. Firefox and chromium varied too much run to run to call. A trace records three kinds of evidence: a DOM snapshot before and after each action, the network log, and a screencast (a filmstrip of frames, which Playwright calls `screenshots`).

### The layout shift

The Phase 83 production check measured Chromium's cumulative layout shift without recent input at 0.044 (1280) and 0.028 (390) over a whole Quick Add flow. Attributed on a clean load of production, with each entry's `sources` (three runs per width):

| Width | Layout shift | Where it came from |
|---|---|---|
| 1280x800 | 0.0139, 0.0139, 0.0140 | **the footer, 0.0137**: `<main>` was only `flex-1` in a `min-h-screen` column, so while the Dashboard's chunk loaded the footer sat at the bottom of the screen (top at y=777), then the Dashboard pushed it off. **The font swap, about 0.0002**: the brand, the header tabs and "Good morning" moved 3 to 6 px when IBM Plex Sans Thai replaced the fallback (`font-display: swap`). |
| 390x844 | 0.00001 each run | the loading outline is already taller than the phone, so the footer never showed. |

Each tab's first visit did the footer's move again: with the page empty during the exit tween and the chunk load, the footer came back on screen, then left (another 0.0128 on a throttled local run, outside the 500 ms that counts as input).

## Decision

### CI traces without the screencast

```ts
trace: process.env.CI
  ? { mode: 'retain-on-first-failure', screenshots: false, snapshots: true, sources: true }
  : 'on-first-retry',
```

A kept trace still holds every action's DOM snapshot, the network log, the call stacks and the test's source, which is what a failure is read from. It loses the filmstrip. That matters for one diagnosis, the Windows WebKit painting stall (ADR `0058`), and that happens locally, not on CI's Linux WebKit; a local `--trace=retain-on-failure` still records the screencast.

**Rejected:**
- **`retain-on-failure`:** it traces retries too, so it costs more and keeps the same first failure.
- **`snapshots: false`:** the snapshots are what make a failure readable; a trace of only actions and network would not have shown Phase 83's empty amount.
- **Only `aria` snapshots** (`snapshots: { dom: false, aria: true }`): not measured; the DOM snapshot is cheap next to the screencast, and the trace viewer shows it as the page.

### `<main>` reserves the screen under the header

`<main>` gets `min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)]`: the viewport minus the header (56 px, 64 px from `md`). The footer therefore starts at or below the fold whatever the view's state: loading, mid-tween or shorter than the screen. A page shorter than the screen now shows its footer after a scroll instead of at the bottom.

### A metric-matched fallback for the font swap

A second family, `IBM Plex Sans Thai Fallback`, sits after Plex in `--font-sans`: four faces (400 to 700) of the local Arial, Arial Bold from 600, with Liberation Sans behind them (metric-compatible with Arial; CI's Playwright image installs it). Each face has Plex's width and vertical metrics:

| Weight | `size-adjust` | `ascent-override` | `descent-override` |
|---|---|---|---|
| 400 | 100.64% | 110.89% | 53.06% |
| 500 | 102.61% | 108.76% | 52.04% |
| 600 | 97.46% | 114.50% | 54.79% |
| 700 | 98.68% | 113.09% | 54.11% |

Measured in Chromium on the shipped font files at 1000 px: `size-adjust` is the canvas width of a UI sample in Plex over Arial's; the overrides are Plex's `fontBoundingBoxAscent`/`Descent` (1116 and 534 per 1000) divided by `size-adjust`, which scales them. `line-gap-override` is 0, as every text utility sets its own line height. The faces cover Plex's Latin range only: Thai text keeps the system Thai fonts, and a device with neither Arial nor Liberation Sans (Android) skips the family as before.

**Rejected:**
- **Preloading the font files:** the build hashes their names, so it needs a build plugin, and 85 kB of high-priority fetches would compete with the entry script on a slow link. The fallback costs no bytes.
- **`font-display: optional`:** a first visit on a slow link would keep the fallback for the whole page view.

## Verification

- **Load, locally, under a throttled link** (150 ms, 1.6 Mbps down), three fresh guests per width, `vite preview` of each build, then one visit to every tab at 1280:

| Build | 1280 | 390 |
|---|---|---|
| `main` | 0.0268 x3 (load 0.0139 + a tab's footer 0.0128) | 0.0000 x3 |
| branch | 0.0000 x3 | 0.0000 x3 |

- **What is left, 0.00001:** a header tab moving 1 px (sub-pixel width rounding) and the "THB" label beside the Net worth figure moving 4 px when the Thai subset arrives, since `฿` comes from it and Arial has none.
- **Nothing else moved:** viewport screenshots of all six tabs at 1280 and 390, after the fonts and a 2 s settle, match `main`'s pixel for pixel, apart from the footer on the three short pages (Transactions, Wallets and Debt payoff at 1280; Wallets and Debt payoff at 390) and 3 px of anti-aliasing at the search box's corner.
- **Trace cost, local WebKit at 4 workers, two runs each:** untraced 3.1 and 3.3 m; ADR `0059`'s full trace 4.7 and 4.1 m; this one 3.4 and 3.3 m. One run of each of the first two had one failure, both the Windows WebKit painting stall (one with no trace at all).
- **A kept trace is still readable.** A deliberately failing test (open Add transaction, type 42, wait for missing text) under both options, in WebKit and chromium:
  - lean: 180 and 181 kB; full: 506 and 769 kB;
  - both: the same 16 and 17 DOM snapshots, 119 network entries, 39 actions and the test source; the open dialog in the snapshot of action 17, the typed 42 in actions 21 and 23;
  - only the full trace has screencast frames (16 and 32).
- **Spec:** `tests/layout-stability.spec.ts`, two tests:
  - a fresh guest's Transactions, Wallets and Debt payoff pages keep the footer below the fold at 1280x720, and Wallets at 390x844 (all browsers);
  - a cold load of the Dashboard at 1280x800 adds up to under 0.0001 of layout shift (Chromium only, the one engine that reports it; skipped elsewhere).
- **Negative controls:**
  - `main`'s `App.tsx`: the footer test fails in all three browsers on a 720 px screen (chromium and WebKit with the footer's top at 655 px on Transactions; Firefox, whose Transactions page is just taller than the screen, at 715.5 px on Wallets); the load test fails 3 of 3 at 0.0137;
  - `main`'s `index.css`: the load test fails 3 of 3 at 0.00020 to 0.00027 (`nav`, the brand text, the tabs).
  On the dev server the branch measures 0.00001; the load test passed 5 of 5 on repeat.
- **Lint** clean; **unit** 829/829 in 32 files (no unit change: jsdom has no layout or fonts).
- **Full suite at 4 workers:** 445 passed and 2 skipped (the load test in Firefox and WebKit) of 447, in 7.5 m, first pass.
- **Bundle** (the branch against `main`'s build, both with `.env`): `index-*.css` 48,810 -> 50,539 B (+1,729 B, +229 B gzip), the four faces; the entry `index-*.js` 189,919 -> 189,976 B (+57 B, +9 B gzip), `<main>`'s classes. Every other chunk is identical once hashed names are normalised. The precache stays 58 entries, 1,655.03 -> 1,656.78 KiB.

## Consequences

- **A failure's CI trace is a third the size and has no filmstrip.** To watch frames, reproduce locally with `--trace=retain-on-failure`.
- **Changing the font changes the fallback faces.** A new weight, a new subset or a different face needs its row measured the same way, or the swap moves text again.
- **`<main>` is at least a screen tall.** A short page's footer is one scroll away.
- **Still open:** the 0.00001 left above, and WebKit on Windows stopping painting now and then (ADR `0058`).
