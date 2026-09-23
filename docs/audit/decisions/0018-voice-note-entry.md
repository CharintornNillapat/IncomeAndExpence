# 0018 — Dictation writes into the note, through the typing path

**Status:** Accepted.
**Date:** 2026-09-24

## Context

ADR `0013` made the note the first field and the engine of the entry form. One string drives four layers: `parseExpressInput` pulls the amount out of it, `smartMatcher` categorizes the stripped remainder, Jev fills the gap on a rule miss, and ADR `0017` offers to remember the correction the user makes afterwards.

That string has only ever been reachable by typing. The app is a Thai-Baht phone-first tracker, and the expense it exists to capture is usually recorded standing at the counter that produced it, one-handed, in Thai. The fastest entry path in the app is the most awkward one to physically reach.

## Decision

**A microphone button sits inside the note field, and its transcript is pushed through `handleDescriptionChange` (`TransactionForm.tsx:273`) — the same function the `onChange` handler calls.**

Voice gets **no pipeline of its own**. This is the whole design, and it is what keeps the phase small:

- The amount is extracted because step 1 of that function already does it.
- The category is matched because step 2 already does it.
- Jev is armed on a miss because step 3 already does it.
- ADR `0017`'s rule chip offers itself because it derives from `description` on render.
- **ADR `0013`'s manual-amount latch protects a hand-typed amount from a transcript ending in digits**, because `userTouchedRef.current.amount` is checked inside that same function.

None of those four layers can tell the difference between a spoken note and a typed one, which is exactly the property wanted. The alternative — a voice-specific path that sets `description` directly and then re-implements extraction and classification — would duplicate the ordering rules in ADR `0011` and the latch rule in ADR `0013`, in a second place, where they would drift.

The latch gets its own test regardless. It is the invariant `csv.spec.ts`, `soft-delete.spec.ts` and `presets.spec.ts` all depend on, and reaching it through a new entry point is exactly the kind of change that quietly breaks it.

## Support detection is two conditions, not one

```ts
const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
const isSupported = Boolean(Ctor) && window.isSecureContext;
```

**The `isSecureContext` half is load-bearing**, and it is the same trap `CLAUDE.md` already documents for `crypto.randomUUID()`: `npm run dev --host=0.0.0.0` is an open invitation to load the app on a phone at `http://192.168.x.x:3000`, which is not a secure context. The constructor is still present there. Recognition cannot run.

Without the second condition the button renders and then fails on tap — on precisely the device this feature exists for, and in precisely the setup the dev script encourages. Playwright cannot catch it either; it always runs on `localhost`, which *is* a secure context.

## Measured: the three test browsers do not agree

Probed on `localhost` before writing any of this, because "we stub because the browsers disagree" is only worth asserting if it is true:

| Project | `SpeechRecognition` | `webkitSpeechRecognition` | `isSecureContext` |
|---|---|---|---|
| chromium | `function` | `function` | `true` |
| firefox | `undefined` | `undefined` | `true` |
| webkit | `undefined` | `undefined` | `true` |

Firefox has the API behind a pref that is off by default; Playwright's WebKit build does not ship it at all. **So in an untouched spec the mic button renders in chromium and is absent in the other two** — a genuine three-way split in the DOM across the suite.

This has two consequences, both deliberate.

**Every voice test installs or deletes the API itself**, via `page.addInitScript` before `goto`. Not one of them relies on what the browser natively provides. Real recognition is untestable anyway — it needs a microphone, a vendor network round-trip, and audio a test cannot produce — so the stub is not a convenience, it is the only option. The upside is that all three browsers then behave identically.

**The six specs that fill the note without installing the mock are unaffected**, and their three-way split is itself the evidence that the feature is inert where it is not wanted. They assert on ids, and a button appearing beside an input changes none of them.

Note for a later reader: an `addInitScript` stub is **not** a `page.route` interception, so this does not breach the rule that `jev-classify.spec.ts` is the only spec in the suite that intercepts requests. It is a new kind of test seam, recorded in `test-selector-contract.md`.

## Interim results go live into the field

`continuous = false`, `interimResults = true`. One tap, one utterance, auto-stopping on silence.

Interim transcripts are written straight into the note as they arrive. This looks like it would thrash the classifier, and it does not, because the machinery to absorb it already exists and was built for exactly this shape: `useDescriptionClassifier` carries a 450 ms debounce, an abort of any superseded request, and a monotonic sequence guard so a slow answer for an older string cannot overwrite a newer one. Interim results are a fast sequence of supersedings, which is the case that guard was written for.

`lastSeededExprRef` (`TransactionForm.tsx`) similarly stops an unchanged parse from re-seeding the amount on every interim frame.

**Options rejected.** *Final-only* gives no feedback that anything was heard beyond a pulsing dot, and delays the amount and category until the user stops speaking. *A separate ghost preview line* avoids mid-speech writes to form state, but adds a second transcript surface and means the downstream layers stay frozen until the utterance ends — which would make the "reacts exactly like typing" property false.

`onresult` rebuilds the transcript by joining every `event.results[i][0].transcript` rather than tracking `resultIndex` deltas, so a re-delivered result cannot duplicate text.

## Dictation appends; it never replaces

The text present when `start` fires is captured and kept, and the transcript is appended after a space.

**This form has no undo.** A mis-tapped microphone that wipes a half-typed note destroys work with no way back, and the mic sits inside the field it would be destroying. Appending also serves the real mixed case — type the merchant, dictate the rest — at no cost.

A "replace if untouched, append if hand-typed" variant was considered and rejected: the rule is invisible, so the same tap would do two different things depending on history the user cannot see.

## Errors are not one case

| `event.error` | Behaviour |
|---|---|
| `not-allowed`, `service-not-allowed` | The button stays **visible but disabled**, with an inline message. Recoverable: the user fixes it in browser settings and a reload re-detects. |
| `audio-capture` | No usable microphone. Same. |
| `no-speech` | Not a failure. Stop quietly with a transient note. |
| `network` | Transient message, **no latch.** |
| `aborted` | The user stopped it. Silent. |

**Disabled-with-a-reason, not hidden**, for the two permission cases. The brief offered either, and a button that silently disappears immediately after being tapped is the worst reading of both: the user's own action makes the affordance vanish, with nothing saying why or how to get it back.

**`network` deliberately does not latch**, mirroring `jevClassifier.ts:200-203`'s reasoning verbatim — the user may be offline for a moment, and latching would disable the feature for a whole session over one dropped request. The permission cases *do* effectively latch, because unlike a network blip they cannot resolve without the user leaving the page.

The hook aborts any live session on unmount. `QuickAddModal` never unmounts once opened (ADR `0010`'s `hasOpened` latch), so the form outlives its own visibility, and a session left running would hold the microphone open after the modal closed.

## Types are declared locally, not installed

The Web Speech interfaces are not in the default DOM lib. `@types/dom-speech-recognition` exists, and is not used: the hook declares minimal local interfaces for the six properties it actually touches. A `package.json` change for zero runtime value is not worth the diff, and the brief asked for zero bundle overhead.

## Consequences

- **`handleDescriptionChange` now has two callers and is load-bearing for both.** A change to its ordering changes voice behaviour identically to typed behaviour — which is the point, but it means it can no longer be reasoned about as "the onChange handler".
- **The note input's padding is conditional** on the button rendering, which means it differs across browsers in the untouched specs. Visual only; nothing asserts on it.
- **The feature is invisible in two of three test browsers by default.** Anyone debugging a voice test in firefox or webkit without the mock installed will find no button, and that is correct rather than broken.

## Deliberately not done

- **No language toggle.** `lang` comes from `navigator.language` with a `th-TH` fallback, which adapts without UI or persisted state. The case this does not serve is a bilingual user on a fixed-locale device; serving it needs its own decision about where the preference lives, and it is a second control in a phase whose point is one button.
- **No continuous dictation.** One tap, one utterance. Continuous mode needs an explicit stop affordance and a story for a session still running when the modal closes.
- **No microphone on any field but the note.** The note already produces the amount, the category and the type, so a mic on the amount input would be a second path to a value the first one already yields.

## Revisit if

- The app gains an undo for form state. Append-not-replace was chosen because there is none; with one, replace becomes defensible.
- Firefox enables `media.webspeech.recognition.enable` by default, or Playwright's WebKit ships the API. The table above stops being the reason the suite stubs — though the untestability of real recognition still is.
- A second field wants dictation. The hook is generic; the append/base-text logic lives in `TransactionForm` and would need extracting first.
