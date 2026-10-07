# 0087: A classification armed during StrictMode's re-run is re-armed; a debt's months left are its payment dates; a new password needs 8 characters

**Status:** Accepted. Released: code `394b588`, docs `6f02dd3`, hash backfill `d13315f`, merged into `main` as `7fb5a5a` (PR #62); Vercel `dpl_FnjqjmuSp1yGgQ1wWv57XSCG3JWW` READY in `icn1`. No migration.
- **Supersedes** spec L4's `monthsLeft` (ADR `0028`), by the owner's decision (audit finding 7).
- **Amends** ADR `0011` (the classifier's debounce and abort): the unmount cleanup re-arms on an effect re-run.
- **Amends** ADR `0024`'s sign-in form (audit finding 5).

**Date:** 2026-10-07

## Context

1. **The WebKit flake in `jev-classify.spec.ts`.**
   - **Symptoms:** "applying a suggestion counts as an explicit pick and offers a rule" failed now and then on local WebKit: 1 in 10 on the Phase 110 branch, 2 in 20 on `main`, and 1 failure in Phase 95, where it was put down to load.
   - **A correction:** Phase 110 recorded that the typed note was lost. That was a misread page snapshot: the line after the Note textbox was its placeholder, and the value was on the next. In the failure examined here the note held "Netflix subscription"; what never appeared was the suggestion chip.
   - **The evidence.** A diagnostic spec counted `/api/classify` requests after filling the note the moment Quick Add opened.
     - It failed 2 times in 80, and **both times no request was sent at all**.
     - Recording a trace hid it (135 of 135 passed), and a check of the note's value 300 ms after the fill never failed in 60 runs, because the value was never the problem.
   - **The cause.** `useDescriptionClassifier` cancels its 450 ms debounce timer and any request in flight in an unmount cleanup, `useEffect(() => cancelPending, [cancelPending])`.
     - In development, StrictMode runs a new component's effects, their cleanups, then the effects again, a task after mount (ADR `0059` met the same cycle for focus).
     - A note typed in between was armed by `classify`, cancelled by that cleanup, and armed by nothing after it.
     - Playwright's fill, sent as soon as the dialog showed, landed there a few times in a hundred. A production build has no StrictMode cycle; `<Activity>` would cause the same.
2. **Finding 7.** `monthsLeft = max(1, months between the calendar months − 1)` dropped a month and ignored the day of the month. A debt due 31 December, seen on 6 October, had one month left instead of about three, so its "Needed / month" was three times too high, and the L5 warning followed it.
3. **Finding 5.** The client asked for 6 characters, the auth server's own floor. One schema (`AuthLoginSchema`) and one `minLength={6}` served sign-in and sign-up alike, so raising them as they stood would have locked out every account whose password is 6 or 7 characters.

## Decision

1. **The classifier re-arms on an effect re-run.** It keeps the text it armed (`armedRef`) until that text is answered, cleared, or replaced by text not worth classifying. Its effect, now declared after `classify`, re-arms that text when it runs and still returns `cancelPending`. A real unmount has no re-run, so it still cancels and sends nothing.
2. **`monthsLeft` counts the monthly payment dates from today up to and including the due date:** today, a month from today, and so on.
   - A date past the end of a shorter month falls on its last day: from 31 January, the next date is 28 February, or 29 in a leap year.
   - It is at least one, so a debt due today or overdue still needs its whole remainder.
   - It works on the ISO strings' numbers, with no `Date`.
   - **New figures:**

     | Case | Months left | Needed / month |
     |---|---|---|
     | 6 Oct → 31 Dec | 3 | |
     | The spec's worked example on 2026-09-28, SPayLater | 4 | ฿3,293.43 |
     | The spec's worked example on 2026-09-28, SEasy Cash | 19 | ฿494.91 |

   - The spec's own figures (3 and 18 months) left out the payment date that falls in the current month.
3. **A chosen password needs 8 characters** (`PASSWORD_MIN_LENGTH`, `NewPasswordSchema`):
   - sign-up uses `AuthSignUpSchema`, and the field gets `minLength={8}` with an "At least 8 characters" hint it is described by;
   - Change Password checks with the same schema, and its placeholder says so;
   - **sign-in checks only that a password was typed** ("Enter your password"), with no `minLength`, so an older, shorter password still signs in. The auth server decides whether it is right.

## Not changed

- **The auth server's own minimum** is a Supabase Auth setting, which only the owner can change in the dashboard. Until it is raised, a client that skips this form can still set a 6-character password.
- **`docs/design/finlife-redesign-spec.md`** keeps its text. The spec records the direction as written; this ADR, `CLAUDE.md` and the unit test carry the rule now.

## Tests

- **`unit/classifier-strict-mode.test.tsx` (new, 2):**
  - a component arms a classification from its first effect, under `StrictMode`, so the hook's cleanup runs after it, as in the browser;
  - the suggestion arrives with one request, which failed before the fix: no request, no suggestion;
  - a plain unmount still sends nothing.
- **Browser, after the fix (local WebKit):**
  - the diagnostic spec passed 120 of 120 runs, against 2 failures in 80 before;
  - the real test passed 60 of 60, against 1 in 40 before.
  - The diagnostic was deleted.
- **`unit/selectors-debts.test.ts`:**
  - `monthsLeft` grew from 3 tests to 6: the recounted spec example, the audit's case, a payment date on the due day and a day after it, today and overdue, month ends (including a leap year), and a year crossing;
  - the spec example's monthly figures and the L5 total (฿3,788.34, shortfall ฿788.34) moved.
  - All failed first.
- **`unit/dashboard.test.tsx`:** the banner and the card's figures (฿3,293.43, ฿494.91).
- **`unit/auth-password.test.tsx` (new, 4):**
  - the schemas: 7 characters refused and 8 accepted for a new password, a 6-character password accepted and an empty one refused for sign-in;
  - the dialog: no `minLength` signing in; `minLength` 8 and the described-by hint when creating an account.
- **`tests/auth.spec.ts`:** the old "6-character minimum" test, which was about sign-in, now checks that sign-in accepts 6 characters, and that sign-up refuses 7, says "At least 8 characters" and accepts 8.
