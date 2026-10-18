# T772 review: stage-file rules from the T767, T770 and T771 reviews

## Round 2

### 1. Metadata

- **Task:** T772, Phase 137 (`phase-137-small-fixes`; base `ef16324`)
- **Date:** 2026-10-17
- **Round:** 2 (fix round 1)
- **Verdict:** APPROVED
- **Target files:** as round 1. `git check-ignore -v`: none ignored.

### 2. Summary

Both blocking items are fixed. The em dash rule's whole-file one-liner now ends `<file>...` with no stray quote, and runs. The refactor-log rule now leaves out only `workflow/stages/*/output/` files. The ledger's T772 Gate result cell was rewritten from the rerun, and the refactor-log Verified part is a word-for-word copy of it, plus a final full stop.

### 3. Invariants and parity

- **Round 1 blocking 1:** fixed. Every spec code block was counted in the stage files with a script. New texts of edits 1 to 7 (5a and 5b): 1 each, edit 2 included. Old texts of edits 3, 5a and 7: 0. The Old texts of 1, 5b and 6 count 1 only as prefixes of their New texts.
- **Round 1 blocking 2:** fixed. Edit 4's New text, with the fix block's replacement, occurs once. `leaving out \`workflow/stages/\` files` occurs 0 times.
- **Nothing else moved:** the numstat is identical to round 1 (2/1, 3/1, 4/4, 4/4, 1/0), so the fix changed only lines already in the diff.
- **Parity map:** no row touched.

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 1a | Edit 2's added-lines one-liner, extracted from `01_spec/CONTEXT.md:51` by script | `0`, exit 0 |
| 1b | Edit 2's whole-file one-liner, extracted the same way, on the five files | Runs without a shell error; `0` for each. Positive control on a file with two em dashes: `2` |
| 1c | `git diff -U0 HEAD \| grep '^+' \| grep -cP '\x{2014}'` | `character value in \x{} or \o{} is too large`, exit 2 |
| 2 | `git ls-files --error-unmatch` on the five files; logs folder | All tracked; folder exists |
| 3 | Spec code blocks counted in the stage files (section 3) | All as expected |
| 4 | `git diff --numstat` | 2/1, 3/1, 4/4, 4/4, 1/0 |
| 5 | `git ls-files --eol`; Node bare `\n` count | All `w/crlf`; 0 bare `\n` |
| 6 | Em dash count (U+2014 from its char code) | 0 in the five files, the build report and this review; added lines 0 |
| 7 | `git status --porcelain` | The five files plus the T772 spec, build report and review only |

### 5. Not verified

- Step 6 does not apply (tests `none`). The new rules take effect in later tasks.

### 6. Blocking

None.

### 7. Non-blocking

1. The fix round's gate 1 still says the `grep -P` check exited "1/2". It exits 2.
2. Round 1's note on the thin T772 **Changed** notes in `refactor-log.md` still applies (optional).

### 8. Rule candidates

Round 1's candidate stands: a text-landed gate reads the expected text from the spec's code blocks with a script. The builder did this in the fix round, and it caught what the retyped check missed.

## Round 1

### 1. Metadata

- **Task:** T772, Phase 137 (`phase-137-small-fixes`; base `ef16324`)
- **Date:** 2026-10-17
- **Round:** 1
- **Verdict:** CHANGES REQUESTED
- **Target files:** `workflow/stages/01_spec/CONTEXT.md`, `workflow/stages/02_build/CONTEXT.md`, `workflow/stages/03_review/CONTEXT.md`, `docs/audit/refactor-log.md`; bookkeeping `docs/audit/task-ledger.md`.
- `git check-ignore -v` on every target: none ignored (exit 1).

### 2. Summary

Every edit except edit 2 landed word for word. Edit 2 did not: the whole-file em dash one-liner has a stray `"` before the closing backtick, so the command, copied as the rule tells the next spec writer to, fails in Bash. Separately, edit 4's rule text (from the spec) excludes all `workflow/stages/` files from **Changed**, which would drop a task's own stage-file edits, T772's included; that is a spec defect, fixed here.

### 3. Invariants and parity

- **Parity map:** no row touched.
- **Text against the spec:** a Node script took every code block from `task-T772-spec.md` and counted it in the stage files. New texts of edits 1, 3, 4, 5a, 5b, 6 and 7: 1 each. Old texts of edits 3, 5a and 7: 0 each. The Old texts of edits 1, 5b and 6 count 1 only because each is the start of its New text, which is expected. **Edit 2's New text: 0.** The first difference is at character 630 of 632: the file has `<file>..."` where the spec has `<file>...`, then the closing backtick (`workflow/stages/01_spec/CONTEXT.md:51`).
- **Stage 03 consistency:** line 3's exception now names the temporary test edit, so it agrees with the new step 6 text. The step 6 line still ends with "No other edit to code, tests or config", which reads correctly with both exceptions inside step 6.
- **Refactor-log:** the header now reads `T769-T772` with `<sha>` placeholders kept. The T772 **Verified** part equals the ledger's T772 Gate result cell, apart from a final full stop. That cell's "7 edits landed once" is false (see Blocking 1).

### 4. Gates run

| # | Command | Result |
|---|---|---|
| 1a | Edit 2's added-lines one-liner, extracted from the stage file as written | Prints `0`, exit 0 |
| 1b | Edit 2's whole-file one-liner, extracted from the stage file as written, with `<file>...` replaced by a path | `bash: -c: line 1: unexpected EOF while looking for matching '"'`. **Fails** |
| 1c | `git diff -U0 HEAD \| grep '^+' \| grep -cP '\x{2014}'` | `grep: character value in \x{} or \o{} is too large`, exit 2, as the rule quotes |
| 2 | `ls -d workflow/stages/02_build/output/logs/`; `git ls-files --error-unmatch` on the five files | Folder exists; all tracked |
| 3 | Node check of every spec code block (section 3 above) | **Edit 2's New text found 0 times**; all others as expected |
| 4 | `git diff --numstat` | 2/1, 3/1, 4/4, 4/4, 1/0, as the spec expects |
| 5 | `git ls-files --eol` and a Node count of bare `\n` | All five `w/crlf`; 0 bare `\n` in each |
| 6 | Em dash count with Node (U+2014 built from its char code) | 0 in each of the five files and in `task-T772-build.md`; 0 in the added lines |
| 7 | `git diff --stat`, `git status --porcelain` | Only the five files and the T772 spec and build report |

### 5. Not verified

- Stage 03 step 6 does not apply: the spec's tests are `none` (docs-only task).
- The new rules' behaviour in a real test-only task or a staged-deletion stash: they are rules for later tasks, so nothing here exercises them.

### 6. Blocking

1. `workflow/stages/01_spec/CONTEXT.md:51` - the whole-file one-liner ends `<file>..."` with a stray `"`, so the command copied as written gives "unexpected EOF while looking for matching" in Bash; the build report's gate 3 ("New text for edits 1 to 7 occurred exactly 1 time") and the ledger's "7 edits landed once" are therefore wrong - delete that one `"` so the line equals the spec's edit 2 New text exactly, then correct the ledger cell and the refactor-log Verified part from the rerun.
2. `workflow/stages/02_build/CONTEXT.md:32` (spec defect, edit 4) - "leaving out `workflow/stages/` files" also drops a task's own stage-file edits, though T772's Changed rightly lists them; the exclusion meant the stage outputs - change `leaving out \`workflow/stages/\` files` to `leaving out \`workflow/stages/*/output/\` files`.

### 7. Non-blocking

1. The build report's gate 1 says the `grep -P` check exited "1/2". It exits 2.
2. The T772 **Changed** notes in `refactor-log.md` are thin ("stage-file rules from reviews"). Naming the rules, as the ledger row does, would read better. Optional.

### 8. Rule candidates

1. **For `workflow/stages/02_build/CONTEXT.md`:** a gate that checks text landed reads the expected text from the spec file's code blocks with a script. It never retypes the text. Gate 3 passed on the builder's side while edit 2 differed by one character, so the expected string was not the spec's.

### 9. Fix block

```
fix T772 (stage file: workflow/stages/02_build/CONTEXT.md)

Blocking 1: in workflow/stages/01_spec/CONTEXT.md, the em dash rule bullet (line 51) ends with `<file>..."` followed by a backtick and a full stop. Delete only the `"` between `...` and the closing backtick, so the line ends `<file>...` then a backtick and a full stop, exactly as the spec's edit 2 New text. Do not retype the rest of the line: the line holds the six-character escape (backslash, u, 2014) twice, and some tools turn it into the em dash character. Make this change with a Node script that replaces the one exact substring, and keep CRLF.

Blocking 2 (spec defect, the spec's edit 4 is superseded here): in workflow/stages/02_build/CONTEXT.md, the refactor-log paragraph (line 32), replace
leaving out `workflow/stages/` files
with
leaving out `workflow/stages/*/output/` files
Change nothing else on the line.

Then update the T772 ledger Gate result cell from your rerun (it must no longer say an edit landed when it did not), and copy that cell word for word into T772's part of the refactor-log Verified line. Append a "## Fix round 1" section to task-T772-build.md.

Gates to rerun (spec section 8, all seven), with these changes:
- Gate 1: run both edit 2 one-liners by extracting them from workflow/stages/01_spec/CONTEXT.md with a script, not by retyping; the whole-file one-liner must run without a shell error and print 0 for each stage file.
- Gate 3: read every expected text from the spec file's code blocks with a script, never retyped. Edit 2's New text must occur exactly once. For edit 4, the expected text is the spec's edit 4 New text with the blocking 2 replacement applied.
- Gate 4 is unchanged: 2/1, 3/1, 4/4, 4/4, 1/0.
```

STATUS: T772 | CHANGES REQUESTED | workflow/stages/03_review/output/task-T772-review.md
