# Spec section 10 acceptance record (2026-10-02)

**Status: record of a check, write-once.** Do not edit a result after the fact; append a dated note under the item instead, as `audit-report.md` and `ui-ux-audit-report.md` do.

This records the redesign spec's acceptance checklist (`docs/design/finlife-redesign-spec.md`, section 10, the spec's step 6 "ตรวจงาน: ไล่ checklist ในหัวข้อ 10") against the app as shipped. Each item is quoted in the spec's Thai with an English gloss, then given a status and the evidence behind it.

- **Code checked:** `main` at `6354c08` (the same code as the Phase 66 merge `7e2daa9`), live at `income-and-expence-neon.vercel.app`; then Phase 67 (ADR `0043`, branch `phase-67-modal-focus-trap`) for item 12's keyboard half.
- **Result:** 13 of 13 items pass after Phase 67. Before it, item 12 passed for contrast and failed for keyboard use, because focus did not enter a dialog.

---

## Method

- **Probe:** scratchpad `accept10.cjs` (Playwright, chromium), 372 checks per run. It seeds a guest ledger into `localStorage` before the app loads (`seedScript`) and reads what the app renders. Every figure it expects is worked out from the seed by hand, not read back from the app.
- **The seed:**
  - four wallets: Main Checking ฿5,000, Cash Wallet ฿1,000, Savings Reserve ฿3,000 and a Visa Card at −฿200 (a credit card, the only wallet allowed below zero), ฿8,800 in all;
  - two debts: SPayLater, ฿4,000 of ฿15,000 still owed and due in four months, and Old Loan, paid off;
  - transactions on today: Lunch ฿120 and Taxi ฿80 (EXPENSE), Pay ฿1,000 (INCOME), a ฿500 transfer, a ฿300 repayment, a −฿50 adjustment, a ฿40 EXPENSE misfiled under the Debt Repayment category, and a deleted ฿999 lunch;
  - EXPENSE rows 3, 7, 8, 30 and 31 days back (฿200, ฿70, ฿33, ฿400, ฿55), so each period boundary of L2 has a row on either side of it;
  - one diary entry today.
- **Where:** production, at 1280, 1024 and 390 px wide, in light and dark. Item 12's keyboard checks run at 1280 and 390. Phase 67's before and after runs used the same probe on a local `vite preview` build (`npm run build` with the repo's `.env`).
- **Early probe failures were probe bugs, fixed in the probe and not the app:**
  - it read the spending figure without its sign;
  - a regex matched a caption as well as the figure it was after;
  - a diary seed used a value the schema refuses, so the app dropped the entry;
  - checks read the page before a view's tween had settled.

  Each was traced to the probe before it was changed. No app code changed because of them.
- **Also run:** `node scripts/wcag-tokens.mjs` (every token text pair), the unit suite, the Playwright suite on three browsers (CI and local), and `modalfocus.cjs` (Tab stops after opening a dialog by keyboard).

## Results

| # | Item | Status |
|---|---|---|
| 1 | One Spending figure per period | PASS |
| 2 | Repayment, adjustment and transfer excluded | PASS |
| 3 | Net worth = wallets − debt | PASS |
| 4 | Needed/month and the L5 warning | PASS |
| 5 | No green, red or violet card borders; red is not an identity colour | PASS |
| 6 | No raw enum, "Transaction", "No category" or "General" | PASS |
| 7 | A row can be edited, saved, deleted and restored | PASS |
| 8 | One transfer icon; no minus outside a wallet's view | PASS |
| 9 | The colour picker blocks a colour in use | PASS |
| 10 | One selected style in the diary; no emoji | PASS |
| 11 | One-row header; icon buttons named | PASS |
| 12 | Contrast 4.5:1 and full keyboard use | PASS after Phase 67 (keyboard failed before it) |
| 13 | Build and existing tests pass | PASS |

### 1. One Spending figure per period
> บน Dashboard ช่วงเวลาเดียวกันต้องให้ตัวเลข Spending ค่าเดียวในทุกการ์ด

*On the Dashboard, one period gives one Spending figure on every card.*

**PASS.** For each of DAY, WEEK, MONTH and ALL, the Cash flow card's Spending, the category card's total and the Transactions page's "Out" are the same figure: ฿200, ฿470, ฿903 and ฿958, at 1280, 1024 and 390, in light and dark. The category card's rows add up to its total in every period. All three come from `isSpending` and `sumSpending` in `src/selectors/ledger.ts` (ADR `0028`).

### 2. Repayment, adjustment and transfer excluded
> Debt Repayment, Balance Adjustment และ transfer ไม่ปรากฏในกราฟหมวดหมู่และไม่ถูกนับใน Spending

*Debt repayments, balance adjustments and transfers do not appear in the category chart and are not counted in Spending.*

**PASS.**
- No such row appears in the category card in any period.
- The ฿40 EXPENSE misfiled under the Debt Repayment category and the deleted ฿999 are both left out of Spending.
- Income is ฿1,000: the ฿500 transfer and the adjustment are not counted.
- Pinned in `unit/selectors-ledger.test.ts`: "excludes transfers, debt repayments and adjustments" and "excludes a row filed under the Debt Repayment or Balance Adjustment category".

### 3. Net worth
> Net worth = ยอดรวมกระเป๋า − ยอดหนี้คงเหลือ (จากข้อมูลตัวอย่างต้องได้ ฿9,595.48)

*Net worth = the wallet total − the debt remaining (the spec's sample data gives ฿9,595.48).*

**PASS.**
- Live: wallets ฿8,800 (the −฿200 card included) − debt ฿4,000 = ฿4,800, on the Dashboard's Net worth card.
- The spec's sample figure, ฿9,595.48, is asserted in `unit/dashboard.test.tsx:154`.
- The ฿0.00 zero state of a new account was verified at the Phase 54 release.

### 4. Needed/month and the L5 warning
> ยอด Needed/month ของหนี้ตรงกับสูตรใน L4 และแถบเตือนแสดงเมื่อเข้าเงื่อนไข L5

*A debt's Needed/month matches the L4 formula, and the warning bar shows when L5's condition holds.*

**PASS.**
- Live: ฿1,333.33 needed a month (฿4,000 due in four months, so three months left under L4's `max(1, months − 1)`), the same on the Dashboard and the Debt payoff page.
- The warning shows against the seed's 30-day surplus of ฿97.00.
- The spec's worked example (฿4,391.23 and ฿522.41) is asserted in `unit/selectors-debts.test.ts:57-58`.

### 5. Card borders and identity colours
> ไม่มีการ์ดใดใช้ขอบสีเขียว แดง หรือม่วง และสีแดงไม่ถูกใช้เป็นสีประจำกระเป๋าหรือหมวด

*No card has a green, red or violet border, and red is not used as a wallet's or category's colour.*

**PASS.** No card border on any of the six views resolves to the income, expense, brand, transfer or violet colours. `IDENTITY_PALETTE` holds the spec's twelve identity colours and no red, green, blue, cyan or amber swatch (`CLAUDE.md` Do NOT list; ADR `0038`).

### 6. No raw text
> ไม่มีค่า enum ดิบหรือข้อความ "Transaction", "No category", "General" หลุดมาถึง UI

*No raw enum value, and no "Transaction", "No category" or "General", reaches the UI.*

**PASS.** A `textContent` scan of all six views and every open dialog (so CSS uppercase labels do not count) finds no enum key, no `A_B` token, no `undefined`, `NaN` or `null`, and no row whose secondary line is "Transaction".

### 7. Edit, save, delete, restore
> คลิกแถวใน Transactions แล้วแก้ไขและบันทึกได้ และลบแล้วกู้คืนได้

*Clicking a Transactions row lets you edit and save it, and delete and restore it.*

**PASS.** `tests/transaction-edit.spec.ts` and `tests/soft-delete.spec.ts`, green on all three browsers in CI run `37003395179`.

### 8. Transfers
> ไอคอน transfer เหมือนกันทุกหน้า และรายการ transfer ไม่มีเครื่องหมายลบนอกมุมมองของกระเป๋า

*The transfer icon is the same on every page, and a transfer row has no minus sign outside a wallet's own view.*

**PASS.** The Dashboard and Transactions rows draw the same icon (the same `svg` class) and print no sign. The wallet's own feed signs it: ฿500.00 with its direction.

### 9. The colour picker
> ตัวเลือกสีไม่ยอมให้เลือกสีที่หมวดอื่นใช้อยู่แล้ว

*The colour picker does not allow a colour another category already uses.*

**PASS.** All seven colours in use are disabled in the grid, and each names the category that holds it (the form is "Rose, used by Pets"). Pinned in `unit/categories-page.test.tsx:170` and `tests/categories-page.spec.ts:16`. Past twelve categories colours may repeat by design (audit 012 finding 1, ADR `0037`).

### 10. The diary's selected style
> สถานะที่ถูกเลือกของ Mood, Activity และ Meals หน้าตาเหมือนกัน และไม่มี emoji

*The selected state of Mood, Activity and Meals looks the same, and there is no emoji.*

**PASS.** The selected Mood, Activity and Meals buttons compute identical background, text and border colours. 0 emoji on the page.

### 11. Header and icon buttons
> header มีชั้นเดียว และ icon button มี `aria-label`

*The header is one row, and icon buttons have an `aria-label`.*

**PASS.** The header's buttons sit on one row at every width checked. 0 icon buttons without a name on any view.

### 12. Contrast and keyboard
> ผ่าน contrast 4.5:1 และใช้งานด้วยคีย์บอร์ดได้ครบ

*Passes 4.5:1 contrast and is fully usable by keyboard.*

**PASS after Phase 67.**
- **Contrast: PASS.** `node scripts/wcag-tokens.mjs`: all 132 token pairs pass, in light and dark (re-run 2026-10-02, 0 failures).
- **Focus ring: PASS.** Each of the first 40 Tab stops on the Dashboard, at 1280 and 390 in light, draws the focus outline (ADR `0029`'s one global rule).
- **Escape and return: PASS.** Escape closes a dialog and focus goes back to what opened it (audit 008). OverflowMenu opens by keyboard, moves with the arrows, and its Escape returns to the trigger. The mobile More sheet closes on Escape and returns focus to More.
- **Focus into a dialog: FAIL before Phase 67.** `Modal` never moved focus into a dialog and did not hold Tab there:
  - at 1280, Quick Add opened with Enter, and Tab then walked the Dashboard behind the scrim;
  - at 390, Quick Add took two Tabs through the nav before reaching the dialog, and Tab past the More sheet's last item went to `<body>`;
  - at 390, a Transactions row opened with Enter showed its sheet with focus left on the row.

  The probe scored 369/372 on production, and these were the three failures ("item12 dialog takes focus" at 1280 and 390; "item12 transaction row opens by keyboard and moves focus to its panel" at 390).
- **After Phase 67 (ADR `0043`): PASS.** `Modal` moves focus to the first control on open, keeps Tab and Shift+Tab inside the dialog, and only the top dialog answers Tab and Escape when one opens over another.
  - The same probe on a local `vite preview` build: item 12 went from 11/14 to **14/14**, and the run from 369/372 to **372/372**. "Dialog takes focus" passes at 1280 and 390; at 390 the Transactions row opened with Enter puts focus on its sheet's close button (`tx-drawer-close-btn`).
  - `modalfocus.cjs`: after opening Quick Add by keyboard at 1280 and 390, all six Tab stops are inside the dialog; the More sheet wraps from its last item to Debt payoff instead of leaving to `<body>`.
  - In chromium, firefox and webkit, light and dark (scratchpad `nested67.cjs`, 22/22 each): a confirmation over the 390 Wallets sheet keeps Tab among its own buttons and Escape closes it alone; the Categories edit sheet keeps 30 Tabs inside; a dialog opened with the mouse draws no ring until the keyboard is used.
  - Pinned by `unit/modal-focus.test.tsx` (19 tests, each guard shown load-bearing by a negative control) and two keyboard checks in `tests/account-and-mobile-nav.spec.ts`.
  - Open, low: nothing beyond `aria-modal` keeps a screen reader's virtual cursor out of the page behind a dialog; not tested with a screen reader (ADR `0043`).

### 13. Build and existing tests
> build และ test ที่มีอยู่เดิมยังผ่านทั้งหมด

*The build and every existing test still pass.*

**PASS.**
- CI run `37003395179` on the code now on `main`: unit 596/596, Playwright 139/139 on each of chromium, firefox and webkit.
- Phase 67, locally: lint clean; unit **615/615** (596 + 19); Playwright **423/423** (141 per browser) on the second full run. The first full run was 420/423: three timeouts on controls Phase 67 does not touch (a Firefox `page.goto`, two WebKit clicks waiting for "stable"), with no assertion failed; the two specs then passed 48/48 alone. `npm run build` succeeds; the entry chunk is 188,651 B (+1,927 B).

## Also checked

- **44 px hit boxes:** 0 interactive elements under 44 px on all six views at 1280, 1024 and 390, outside `DESIGN.md`'s documented exceptions (the calculator keys, the note field's microphone, the form's shortcut links, inline text links).
- **Responsive:** no horizontal scroll on any view at 1280, 1024 or 390.
