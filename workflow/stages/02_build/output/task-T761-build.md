# Build report: T761

Phase 133: Dashboard redesign DOC-1: owner spec, ADR 0102, DESIGN.md, routing.

## Files changed (7 files + build report)

1. `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`:
   - Added ADR 0102 recording decisions D1 through D5, amending ADR 0030.
   - Set status as Accepted, established owner spec and mock as authority for Dashboard redesign.
   - Preserved CRLF line endings, 0 em dashes.
2. `DESIGN.md`:
   - Replaced Dashboard section (lines 161-175) with 2026-10 redesign target description and block layout table.
   - Status line marks it as redesign target for Phases 134 and 135.
   - Preserved CRLF line endings, 0 em dashes.
3. `AGENTS.md`:
   - Added Dashboard redesign tasks row to context routing table.
   - Clarified `docs/design/*.html` rule to cover all HTML in `docs/design/` with the named exception for dashboard redesign mock lines.
   - Preserved CRLF line endings, 0 em dashes.
4. `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html`:
   - Added owner mock file, verified byte-for-byte unchanged from source.
5. `docs/design/dashboard-2026-10/spec.md`:
   - Added owner redesign spec and corrected 4 lines to match code per owner order: line 9 (transfer hue), line 23 (`text-fg-*` tokens), line 27 (transfer hue row), line 30 (`ProgressBar`).
   - Preserved pure LF line endings (0 CRLF), 0 em dashes.
6. `docs/audit/refactor-log.md`:
   - Added Phase 133 entry documenting changes, gate verifications, surprises (none), and deliberately not done scope.
   - Preserved CRLF line endings, 0 em dashes.
7. `docs/audit/task-ledger.md`:
   - Added Phase 133 section above `## Backlog` with T761 row marked done; Commit cell left empty.
   - Preserved CRLF line endings, 0 em dashes.

## Tests added and fail-then-pass evidence

- None (docs-only task, per spec section 8: no code or tests added).

## Gate commands and results

1. Gate 1 (Mock HTML unchanged):
   - Command: `node -e "console.log(crypto.createHash('sha256').update(fs.readFileSync('docs/design/dashboard-2026-10/dashboard-2026-10.dc.html')).digest('hex'))"`
   - Result: `d3d0e013775b93767cc3d44cf2a9c78a48f5069726466aa0c405d1010b79d319` matches spec section 2 hash.

2. Gate 1a (Owner spec, only four lines):
   - Original backup saved to `workflow/stages/02_build/output/logs/T761-spec-original.md`, verified sha256 `631341e009b86bda5726296f65e170dc84dc7f82daf80bc74bddfe81aff2ad5b`.
   - Command: `git diff --no-index --numstat workflow/stages/02_build/output/logs/T761-spec-original.md docs/design/dashboard-2026-10/spec.md`
   - Result: `4 4`.
   - Command: `git diff --no-index -U0 workflow/stages/02_build/output/logs/T761-spec-original.md docs/design/dashboard-2026-10/spec.md`
   - Result: Only lines 9, 23, 27, 30 modified, matching section 7.5's text exactly.
   - Command: `sha256sum docs/design/dashboard-2026-10/spec.md`
   - Result: `09f30687bece1d4661e80db7947b14618463dafbcd1502b2994e02d889d90242` matches expected hash.

3. Gate 2 (Scope):
   - Command: `git status --porcelain`
   - Result: `M` on `AGENTS.md`, `DESIGN.md`, `docs/audit/refactor-log.md`, `docs/audit/task-ledger.md`; `??` on `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`, `docs/design/dashboard-2026-10/`, `workflow/stages/01_spec/output/task-T761-spec.md`, and build report. Scope clean.

4. Gate 3 (DESIGN.md touched only in its Dashboard section):
   - Command: `git diff -U0 DESIGN.md`
   - Result: Exactly one hunk starting at line 161.
   - Command: `git diff DESIGN.md | Select-String '^[-+]###'`
   - Result: Only old and new `### Dashboard` headings in diff; line 208 follows after one blank line with `### Transactions (spec 6.2, ADRs 0031 and 0033)`.

5. Gate 4 (AGENTS.md diff numstat):
   - Command: `git diff --numstat AGENTS.md`
   - Result: `2 1`.

6. Gate 5 (Names exist):
   - CSS tokens and radius: all 15 semantic tokens (`canvas`, `surface-1`, `surface-2`, `surface-3`, `line`, `fg`, `fg-secondary`, `fg-muted`, `brand`, `brand-soft`, `brand-tint`, `brand-line`, `income`, `expense`, `transfer`) and `--radius-card` match in `src/index.css`.
   - Components: `SegmentedControl.tsx`, `Button.tsx`, `Money.tsx`, `PageHeader.tsx`, `ProgressBar.tsx` in `src/components/ui/` and `AddWalletModal.tsx` in `src/components/wallet/` exist.
   - Exports: `TransferFundsModal`, `NavbarSyncBadge`, `onOpenTransfer`, `txTypeMetaFor` found in `src`.
   - Selectors: `cashFlow`, `spendingByCategory`, `groupByDay`, `payoffPercent`, `debtPlan`, `requiredMonthly`, `netWorth`, `walletShares`, `moodSpendingDays` exported in `src/selectors/`.
   - Files: `docs/audit/test-selector-contract.md` and `scripts/wcag-tokens.mjs` exist.
   - Absent names: `text-secondary`, `text-muted`, and `ProgressMeter` appear 0 times in corrected `spec.md`, new DESIGN.md section, and ADR 0102.

7. Gate 6 (Line citations in ADR):
   - Checked `DESIGN.md:57`, `:80`, `:108`, and `:333 to :337` against post-edit `DESIGN.md`.
   - Checked `spec.md:5`, `:9-13`, `:100`, `:101` against owner `spec.md`. All line citations match.

8. Gate 7 (Line endings):
   - `git ls-files --eol AGENTS.md DESIGN.md docs/audit/refactor-log.md docs/audit/task-ledger.md`: all 4 show `w/crlf`.
   - ADR 0102: 53 CRLF, 0 bare LF.
   - `spec.md`: 0 CRLF, 101 LF (pure LF preserved). HTML mock: pure LF preserved.

9. Gate 8 (No em dash U+2014):
   - `git diff -U0` added lines: 0 em dashes.
   - ADR 0102: 0 em dashes.
   - Corrected `spec.md`: 0 em dashes.
   - HTML mock: 0 em dashes.

10. Gate 9 (Task ledger):
    - Phase 133 section placed above `## Backlog`.
    - T761 row marked `done`, Commit cell left empty.

## Not done

- Section 10 items (out of scope):
  - No edit to HTML mock, and no edits to `spec.md` beyond section 7.5's four lines.
  - HTML mock never opened.
  - Rest of `DESIGN.md` left untouched (describing shipped page until Phase 135).
  - ADR 0030 text not edited (amended by reference).
  - No baseline metrics section (no bundle or test counts changed).
  - No code or test files touched.
