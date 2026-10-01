# 0037: The Categories page, one colour per category (L9), a locked System group, and tab labels from 1280

**Status:** Accepted.
- **Implements** spec 6.6, the sixth and last page of the redesign (spec 9, step 4), with L9 and L10.
- **Closes** audit 004 finding 1 (the raw type enum on each row) and audit 007 finding 1 (the tab bar overflowing at 1024px).

**Date:** 2026-10-01

## Context

The Categories page had these problems before this phase:
- a carded "Categories & Smart Rules" header;
- the Add form on the left and the list on the right, the reverse of the spec;
- each row printed its raw type (`EXPENSE`, `DEBT_REPAYMENT`, `ADJUSTMENT`), with uppercase "Default" and "In use" tags and a pencil and a trash icon;
- editing happened in a modal, with an icon picker whose value nothing in the app displays;
- the colour picker offered ten colours, including red, green, blue and amber, which carry money meaning;
- **L9 was not applied:** two categories could share a colour;
- **L10 was not applied:** Debt Repayment and Balance Adjustment could be renamed and recoloured, although the ledger finds them by type and every screen names them "Debt repayment" and "Balance adjustment" whatever they are called;
- the Smart rules tab showed `(EXPENSE)` in its picker and "EXPENSE" in its sandbox, under a sparkle icon (audit 005).

**Separately, the header's tab bar** no longer fit at 1024px once "Debt payoff" and "Daily diary" replaced the shorter labels. It scrolled sideways and cut "Categories" to "Cate" (audit 007 finding 1, deferred to this phase).

Spec 6.6 asks for:
- a PageHeader "Categories" with a Categories / Smart rules tablist;
- the list at 7/12 in three groups (Expense, Income, System), each row a 12px dot, the name, a tag and ›, the whole row opening it;
- a "New category" form at 5/12: Expense / Income on top, Name, Description, a 6-column grid of the 12 identity colours with used ones disabled, and "Add category";
- a row click turns the form into "Edit category", with Save and Delete.

The owner's decisions (2026-10-01):
- **Delete works only while nothing uses the category.** There is no move-then-delete.
- **Spec 5.1's colour migration is its own phase (Phase 63).** This phase changes the picker and applies L9, and the stored colours stay as they are.
- **Below 1280px the header tabs show their icon only.**
- Antislop runs afterwards, as audit 011 (mode 2).

No migration.

## Decision

### Logic
- **`utils/identityPalette.ts`** holds the twelve colours with their names (Tan … Iris). `WALLET_COLOR_PALETTE` is now an alias of it, so wallets and categories offer the same twelve.
- **`selectors/categories.ts`:**
  - `categoryGroups` splits the live categories into Expense, Income and System, each sorted by name. System is matched by type (`isMovementCategory`), never by id, since signed-in rows carry uuids.
  - `categoryUsage` counts a category's live transactions and its keyword rules, the same two things `deleteCategory` checks.
  - `firstFreeColor` gives the first of the twelve that nothing uses.
  - `usedColors` is reused unchanged.
- **Guards in `FinanceContext`**, each reading `categoriesRef` before any state change (ADR `0022`):
  - **`addCategory`** refuses a colour another live category uses ("That colour is used by Food & Dining").
  - **`updateCategory`** refuses the same, but only when the colour changes, so a category already sharing a colour from before L9 can still be renamed.
  - **`updateCategory`** refuses any edit to a System category ("System categories can't be edited").
  - **`deleteCategory`** is unchanged: no default, and nothing in use.

### The page
- **`CategoryList`:**
  - three sections, `#category-group-expense|income|system`, with the headings in `expense`, `income` and muted grey;
  - an Expense or Income row is `li#category-row-{id}` holding one full-width `button#edit-category-{id}`: a 12px dot, the name, a `Badge` ("Default", "Custom" or "Custom · in use") and a ›. It is `aria-pressed` while it is in the form;
  - **a System row is not a button.** It shows `systemCategoryLabel` ("Debt repayment", "Balance adjustment"), "Not counted as income or spending", a grey dot in `SYSTEM_CATEGORY_COLOR` and a lock.
- **`CategoryForm`** is one component for both modes, keyed by the category, so its fields start from it with no effect copying state:
  - **New:**
    - the type SegmentedControl, `#new-category-type-expense|income`;
    - `#new-category-name` and `#new-category-description`;
    - the colour grid;
    - `#save-category-btn` "Add category".

    After an add, the form remounts on the next free colour and keeps the type.
  - **Edit:**
    - the type as text, since it is fixed once a category exists;
    - `#edit-category-name`, `#edit-category-description` and the grid;
    - "Save changes", and Cancel, which returns to New with focus on the row;
    - `#delete-category-{id}`, on a custom category only, disabled with "Used by 3 transactions and 1 rule, so it can't be deleted." when something uses it. A default reads "Default categories can't be deleted." instead.
- **`ColorGrid`** shows the twelve colours in six columns, each a 28px swatch in a 44px button named by its colour:
  - a colour in use is disabled, its fill at 0.25 opacity under a full-strength diagonal strike, and named "Rose, used by Food & Dining" in its label and tooltip. Opacity alone read as a paler colour, not an unavailable one (audit 011 finding 1);
  - **a category whose stored colour is not one of the twelve** shows it as an extra "Current colour" swatch, selected. Every shipped category is in that state until Phase 63, and without the swatch a Save would have to change its colour.
- **Narrow widths:** one render path through `useMediaQuery('(min-width: 1024px)')`, as on the Wallets page (ADR `0034`). From `lg` the form switches mode in place; below it the New form stacks under the list and an edit opens in a `Modal` sheet. Below `lg` the header also offers `#open-new-category-btn` "Add category", which focuses the New form's Name and scrolls it into view (audit 011 finding 2).
- **Delete** confirms in a `ConfirmDialog`: "Delete "X"? It leaves your categories and every category picker. No transaction or rule uses it." It checks the result, keeps a failure in the dialog, and then moves focus to the list's heading.
- **The Smart rules tab** moved unchanged in behaviour into `SmartRulesPanel`:
  - types read as words ("Groceries (Expense)", the sandbox's "Expense"), and the System categories by their L10 names;
  - headings are in sentence case, with no decorative heading icons, the sparkle included;
  - every id and `data-testid` is kept.
- **The header** shows each tab's label from `xl` (1280px) and its icon below it. `title` and the accessible name are unchanged, so no spec moved.

### Deviations from spec 6.6
- **The shipped categories keep their old colours** until Phase 63 (the owner's decision), shown through the "Current colour" swatch.
- **Edit happens in a sheet below `lg`**, as spec 8 asks for forms on small screens.
- **The type is not editable once a category exists**, as before. A category's type is what its transactions were filed under.
- **The icon picker is gone.** No screen shows a category's icon, and the stored value is kept.
- **The plan named a flask icon for the sandbox;** the heading icons were dropped instead, since none of them carried meaning.

## Spec edits
These are locator or copy moves only:
- **`categories.spec.ts`:**
  - the type select became a click on `#new-category-type-income|expense`;
  - `toContainText('INCOME')` became the row being inside `#category-group-income`;
  - the default-has-no-Delete test and the two delete tests open the row's form first. The count-0 check is then made with the form open, so it is not vacuous;
  - the dialog is "Delete category", and "Close modal" became `#edit-category-cancel-btn`.
- **`keywords.spec.ts`:** `Groceries (EXPENSE)` and `EXPENSE` became `Groceries (Expense)` and `Expense`.
- `smart-rules.spec.ts` and `account-and-mobile-nav.spec.ts` passed unedited.

## Consequences
- **No two categories can get the same colour** from this page or from a stale form, and the twelve exclude the money colours.
- **The two System categories can no longer be renamed** to something every other screen would ignore.
- **No raw type enum reaches the Categories page.**
- **At 768 to 1279px the header shows icons only**, each named by `title` and its accessible name.
- **Tests:**
  - `unit/categories-page.test.tsx` (18, two of them for audit 011's fixes);
  - 4 selector tests in `selectors-display.test.ts`;
  - 3 signed-in guard tests in `authenticated-ledger.test.tsx`;
  - `tests/categories-page.spec.ts` (3 guest tests, nothing intercepted).

  Each of these controls failed its test:
  - a shared colour accepted on add;
  - a shared colour accepted on edit;
  - a System category edit accepted;
  - a raw type on the row;
  - Delete enabled while in use;
  - a used swatch that could be clicked;
  - the older colour lost on Save.
