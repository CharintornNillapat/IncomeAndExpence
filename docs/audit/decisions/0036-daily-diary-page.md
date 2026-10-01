# 0036: The Daily diary page, a form that starts from the day's own entry, and a day hand-off to Transactions

**Status:** Accepted.
- **Implements** spec 6.5, the fifth page of the redesign (spec 9, step 4).
- **Extends** the Transactions page's hand-offs (ADR `0031`, `0033`) with one more: a single day.

**Date:** 2026-10-01

## Context

The Daily diary had these problems before this phase:
- a carded "Daily Diary" header;
- an emoji on every mood button and every entry;
- meal buttons coloured green, amber and red by how good the food was, and an orange "Avg Food" badge;
- a bare date input;
- a trash icon on every entry that deleted at once and ignored the result.

**Two bugs sat underneath:**
- **The form never loaded the selected day's saved entry when the page opened.** It started at mood 5, a workout, and "Morning cardio & bodyweight exercises" already typed. The Dashboard's "Edit today's entry" therefore opened the wrong values, and one tap on Save overwrote today's entry with them.
- **A future date could be picked and logged.**

Spec 6.5 asks for:
- a PageHeader "Daily diary" with "Export JSON";
- a 7/5 layout with the entry form on the left. The form has:
  - "Monday, Sep 28" and "Today · spent ฿X in N transactions so far";
  - ‹, Pick date and ›;
  - Mood as five number-and-word buttons, no emoji;
  - Activity as Rest day / Workout;
  - Meals as three options, all in **the same** selected style;
  - Notes, and "Save entry";
- on the right, a Monday-first month calendar and a list of recent entries.

The owner's decisions (2026-10-01):
- Delete confirms first, in a dialog that says what is removed and that the day's transactions are untouched.
- A day with no entry starts with no mood picked, and Save waits for one.
- "N transactions" opens the Transactions page filtered to that day. The old expander goes.
- Antislop runs afterwards, as audit 010 (mode 2).

No migration.

## Decision

### Logic
- **`selectors/diary.ts`:**
  - `daySpending(txs, date, categories)` returns `{ spending, count }` on L1. It is live `isSpending` rows only, so a transfer, a repayment or an adjustment is not a day's spending. `moodSpendingDays` now uses it.
  - `diaryMonth(entries, monthKey)` returns the live diary dates in a month.
- **`utils/date.ts`:** `monthGrid` (weeks starting Monday, with `null` padding), `shiftMonth`, `monthKeyOf`, `formatMonthYear` and `formatDiaryHeading`, all built from local calendar parts.
- **`components/diary/diaryLabels.ts`:**
  - the mood words: Very low, Low, Neutral, Good, Great;
  - Rest day / Workout;
  - the three meal labels;
  - the entry summary.
- **`MoodMeter`** moved out of the Dashboard's Mood & spending card; both pages use it.
- **A `logged` token:** `#3B2F73` in dark, as the spec gives it, and `#DDD6FE` in light. Its `fg` pair is checked in `scripts/wcag-tokens.mjs` (12.86 light, 9.49 dark).

### The page
- **`DiaryEntryForm`** is mounted with `key={date + entry id}`, so its fields start from the day's saved entry. No effect copies the entry into state.
  - A day with no entry starts with no mood, a rest day, average meals and an empty note. Save is disabled, with "Pick a mood to save." under it.
  - ‹ and › step a day; › is disabled on today.
  - "Pick date" opens a visually hidden `input#diary-date-picker` (`max` = today) through `showPicker()`. A typed future date is ignored.
  - Mood (`#mood-btn-1..5`), Activity (`#activity-btn-rest` / `-workout`, Workout shows `#diary-workout-note`) and Meals (`#food-btn-healthy|average|junk`) all use one selected style: `bg-selected text-on-selected` with a `focus` border, plus `aria-pressed`.
  - The page keeps "Diary entry logged for …", so it survives the remount that a first save causes, and clears it when the day changes.
- **`DiaryCalendar`:**
  - the week starts on Monday;
  - a logged day sits on `bg-logged`, today has an inset `focus` ring, and a future day is disabled in `fg-disabled`;
  - on the form's day today's ring is white, because a violet ring disappears into the brand fill (audit 010 finding 3);
  - the day in the form is `aria-pressed`, in the brand fill;
  - every day is a button named in full, for example "Wed, Sep 30, logged";
  - it has a legend and "N days logged in September". Its ‹ › change the month, and › is disabled on the current one.
- **`RecentEntries` / `DiaryEntryRow`** replace `DiaryEntryCard`:
  - newest first, ten at a time;
  - each `#diary-card-{id}` has the day (spec 4.10's label), its spending in red, a `MoodMeter`, "Neutral · Rest day · Average meals · N transactions", the workout note, and the note in an inset (`data-testid="diary-entry-notes"`);
  - Edit and Delete sit in the ⋯ menu (`#diary-menu-btn-{id}`, `#edit-diary-{id}`, `#delete-diary-{id}`). Edit loads the day and moves focus to the form's heading.
- **Delete** is a `ConfirmDialog` that checks `deleteDiaryEntry`'s result; a failure stays in the dialog. Focus then goes to the next entry's menu, or to the list's heading.
- **The day hand-off:**
  - "N transactions" (`#diary-day-tx-link-{date}`) calls `App.tsx`'s `handleOpenDayTransactions`, shaped like the wallet-filter hand-off.
  - `TransactionsView` takes `initialDayFilter`. That day becomes the list's start and end date, the summary names it, and a soft `#tx-day-filter` button ("Only Wed, Sep 30 ×") clears it. A range change clears it too.
  - While the day is shown, the range select reads "One day", a disabled option present only then, so it never claims "All time" beside the day's button (audit 010 finding 1).
  - `TimeRange` and the L2 selectors are untouched.

### Copy
The header tab and the mobile More item read "Daily diary", and the Dashboard card reads "From your daily diary", as "Debt payoff" was aligned in audit 009.

### Deviations from spec 6.5
- **The form is stacked above the calendar and the list below `lg`.**
- **A day with no entry has no mood picked** (the owner's decision); the spec does not say.
- **The workout note is kept**, under Workout and in each recent entry. It is the app's existing option; the spec's mockup does not show it.
- **Recent entries show ten at a time**, with "Show N more". The spec does not say how many.
- **The day in the form is drawn in the brand fill**, which the spec does not mention, so the calendar shows which day the form holds.

## Spec edits
None. `diary.spec.ts` and `theme.spec.ts` passed unedited: their ids, the `/Daily Diary/i` heading match (case-insensitive) and the "Diary entry logged" text are kept.

## Consequences
- **The Dashboard's "Edit today's entry" now opens today's entry.**
- **Nothing is pre-typed, so an accidental Save cannot write a made-up workout.**
- **Deleting an entry asks first.** The day's transactions were never touched, and the dialog now says so.
- **Tests:**
  - `unit/diary-page.test.tsx` (17);
  - two day-filter tests in `unit/transactions-page.test.tsx`;
  - `tests/diary-page.spec.ts` (3 guest tests, nothing intercepted).

  Each of these controls failed its test:
  - the form ignoring the saved entry;
  - Save enabled with no mood;
  - Delete without the confirm;
  - a Sunday-first grid;
  - a clickable future day;
  - bounds that ignore the day filter.
