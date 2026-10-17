# T761 review

## Round 1

### Metadata

- **Task:** T761, Dashboard redesign DOC-1: the owner spec and mock, ADR 0102, DESIGN.md's Dashboard section, the AGENTS.md routing row. Phase 133, branch `phase-133-dashboard-redesign-docs`.
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** APPROVED
- **Target files:**
  - `docs/design/dashboard-2026-10/spec.md`
  - `docs/design/dashboard-2026-10/dashboard-2026-10.dc.html`
  - `docs/audit/decisions/0102-dashboard-redesign-2026-10.md`
  - `DESIGN.md`
  - `AGENTS.md`
  - `docs/audit/refactor-log.md`
  - plus the ledger as bookkeeping

  `git check-ignore -v` on every target: none ignored (exit 1). The builder's backup `workflow/stages/02_build/output/logs/T761-spec-original.md` is ignored, as the spec intends.

### Summary

Docs only.
- ADR 0102 records D1 to D5 and amends ADR 0030 by reference.
- DESIGN.md's Dashboard section is replaced by the target text, which matches spec section 7.2 byte for byte.
- AGENTS.md gains the routing row and the widened "never open" clause, both word for word from the spec.
- The owner's mock goes in unchanged. The owner's `spec.md` goes in with exactly the four corrected lines (9, 23, 27, 30).
- The ledger and refactor log carry the Phase 133 paperwork.

### Invariants and parity

- **Parity map:** no row touched. No code, test or config changed, so no id, type or SQL pair moves.
- **AGENTS.md:** the new row sits directly after "Visual work" (`AGENTS.md:103`). Line 108 reads exactly as spec 7.3 item 2. Nothing else changed.
- **DESIGN.md:** one `-U0` hunk at line 161. The only `###` change is the Dashboard heading, and `### Transactions` follows after one blank line. The block equals the spec's fenced text exactly (Node comparison, after normalising CRLF). The file is 353 CRLF with 0 bare LF.
- **ADR 0102:**
  - Its shape matches 0100 and 0101 (title, Status bullets, Date, Context, Decision, Consequences).
  - Each Why comes from the source the spec names. No Consequences bullet about the name slips.
  - Every citation holds after the edit:
    - `DESIGN.md:57` is the contrast paragraph, `:80` "Hero number (net worth)", `:108` the THB line.
    - `DESIGN.md:333` to `:337` are the five Dashboard deviation rows, moved from 302 to 306 by the +31-line replacement, as gate 6 anticipated.
    - `spec.md:5`, `:9` to `:13`, `:100` and `:101` hold the text cited.
- **Owner files:** the HTML is byte for byte. `spec.md` differs from the original in exactly four lines, each equal to spec 7.5's New text. Both stay LF.
- **Ledger:** the Phase 133 section sits above `## Backlog`, in the template's shape, with the Commit cell empty.

### Gates run

Docs-only tier: no lint or test run (AGENTS.md). Every stated count and path was checked against the code.

| # | Check | Result |
|---|---|---|
| 1 | `sha256sum` of the HTML | `d3d0e013...d319`, matches spec section 2 |
| 1a | Backup hash; `git diff --no-index --numstat` and `-U0` of backup vs `spec.md`; `sha256sum spec.md` | backup `631341e0...ad5b`; `4 4`; hunks only at 9, 23, 27, 30; `09f30687...0242`, matches |
| 2 | `git status --porcelain` | `M` on AGENTS.md, DESIGN.md, refactor-log.md, task-ledger.md; `??` on ADR 0102, `docs/design/dashboard-2026-10/`, the T761 spec and build report. Nothing unannounced |
| 3 | `git diff -U0 DESIGN.md` hunks; `^[-+]###` lines | 1 hunk at 161; only the old and new Dashboard headings |
| 4 | `git diff --numstat AGENTS.md` | `2 1` |
| 5 | Names | all 15 `--color-*` tokens and `--radius-card` present; 6 component files and 2 doc/script paths exist; 9 selector exports and 5 symbols resolve; `text-secondary`, `text-muted`, `ProgressMeter` (whole names) 0 in `spec.md`, ADR 0102 and the new section |
| 6 | ADR citations | all hold (see above) |
| 7 | Line endings | `git ls-files --eol`: `w/crlf` on all four tracked files. ADR 0102: 53 CRLF, 0 bare LF. `spec.md`: 0 CRLF, 101 LF. HTML: 0 CRLF, 319 LF |
| 8 | Em dash (U+2014) | 0 in `git diff -U0` added lines, ADR 0102, `spec.md` and the HTML |
| 9 | Ledger | in place; Commit empty |

No full-suite run applies, so no logs are saved for this round.

### Not verified

- **That the builder never opened the HTML:** the report says so, and the hash proves it unchanged, but whether it was read cannot be shown.
- **Rendering:** the DESIGN.md table and the AGENTS.md row were not rendered as Markdown. Both are well-formed pipe tables with the header's column count.

### Blocking

None.

### Non-blocking

- **Repeated Why lines in ADR 0102:** the Why lines of D3, D4 and D5 (`:34`, `:40`, `:46`) mostly repeat the decision text above them. This is harmless; a later edit could cut each to its new part (D4's "16 days against 30").
- **Hashes after a fresh checkout:** git warns "LF will be replaced by CRLF the next time Git touches it" for both owner files. `core.autocrlf` stores LF in the commit, so the committed blobs match the hashes. A fresh Windows checkout will write them as CRLF, though, and a later `sha256sum` of the working copy will then differ. Check the committed blob (`git show HEAD:<path> | sha256sum`) when re-verifying.

### Rule candidates

- **A spec that pins a file by SHA-256** should name what it hashes: the working copy before the commit, or the committed blob (`git show <rev>:<path>`). Under `core.autocrlf=true` the two differ after a checkout.
