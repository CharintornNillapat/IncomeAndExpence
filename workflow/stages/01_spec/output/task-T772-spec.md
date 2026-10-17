# T772 spec: stage-file rules from the T767, T770 and T771 reviews

Phase 137 (`phase-137-small-fixes`). Docs-only task. No ADR: ADR `0101` already governs the stage files, and T757 (Phase 130) added a stage 01 rule the same way.

## 1. Goal

Add to the workflow stage files the rule candidates from the T767 review, plus two newer ones: from T770, a task that only strengthens a test makes its failing run inside the test file, since a stash of the source has nothing to remove, and (the owner's amendment) the reviewer reproduces that red run itself with the same temporary test edit, reverts it, and confirms `git diff` shows only the task's changes, because the builder's red log alone is not enough; from T771, specs count em dashes with a Node one-liner, not `grep -P`, which fails in this shell.

## 2. Target files

```
workflow/stages/01_spec/CONTEXT.md
workflow/stages/02_build/CONTEXT.md
workflow/stages/03_review/CONTEXT.md
docs/audit/refactor-log.md
```

Bookkeeping (always allowed): `docs/audit/task-ledger.md` (the T772 row under Phase 137) and `workflow/stages/02_build/output/task-T772-build.md`.

`refactor-log.md` is listed because T770 and T771 each appended their part to the open Phase 137 entry; T772 does the same. No `baseline-metrics.md` change (no bundle or test count changes).

## 3. Context to read

None (docs-only task).

## 4. Current behaviour

The rule sources:

- **T767 review, rule candidate 1** (`workflow/stages/03_review/output/task-T767-review.md`, Round 1 section 8): build a phase's `refactor-log.md` entry from the commits and the ledger, never from memory (Changed from `git show --stat <sha>`, Verified from the ledger Gate result cell, Surprises only from a review or build report). Its blocking item 1 was a refactor-log entry written from memory that named files which never existed.
- **T767 review, rule candidate 2** (same section): in stage 03 step 6, a staged deletion matches no path for `git stash push -- <path>`, so stash its folder and restore with `git stash pop --index`; leave an LF file out of the stash, because under `core.autocrlf` (this repo: `true`) the pop rewrites it to CRLF. Round 1 section 5 records both happening.
- **T770 review, rule candidate 1** (`task-T770-review.md:56`): when a task only strengthens a test, the red step happens inside the test file; the reviewer checks the red log. T770's spec spelled the order out (`task-T770-spec.md:86-91`). **Owner's amendment (after the first draft of this spec):** checking the log is not enough; the reviewer repeats the temporary edit, sees the failure, reverts it, and confirms `git diff` shows only the task's changes. The builder still records its red run in the build report.
- **T771 review, non-blocking 3** (`task-T771-review.md:52`): the spec's `grep -cP '\x{2014}'` gate fails in this shell. Reproduced while writing this spec: `grep: character value in \x{} or \o{} is too large`, exit 2.

The stage files today:

- `workflow/stages/01_spec/CONTEXT.md:39`: section 6 says only that `none` skips stage 02 step 4 and stage 03 step 6. Nothing covers a test-only task.
- `workflow/stages/01_spec/CONTEXT.md:50`: the line-ending rule. No em dash counting rule.
- `workflow/stages/02_build/CONTEXT.md:25`: step 4 says to run the new tests "against the unchanged code", which has no meaning when the only change is the test.
- `workflow/stages/02_build/CONTEXT.md:17` and `:30`: nothing on how to build a refactor-log entry.
- `workflow/stages/03_review/CONTEXT.md:3`: the reviewer "never edits app code, tests or config (step 6's stash is the one allowed exception)". The amended rule needs a temporary test edit, so edit 5 also updates this line; otherwise the two lines contradict each other.
- `workflow/stages/03_review/CONTEXT.md:12-17`: step 6 always stashes, `6.2` says `git stash push -- <files>`, and `6.4` says plain `git stash pop`.
- All three stage files, `refactor-log.md` and `task-ledger.md` are `w/crlf` (`git ls-files --eol`).

Both Node one-liners in edit 2 were run while writing this spec: the added-lines counter printed 1115 on `git diff -U0 HEAD~40 -- docs`, the same as a byte-level `grep -o` count of the UTF-8 sequence; the whole-file counter printed 2 on a test file with two em dashes and 0 on `workflow/stages/01_spec/CONTEXT.md`.

## 5. Parity map

None.

## 6. Tests to add

None. The change is to Markdown rule files only and cannot alter app behaviour, so stage 02 step 4 and stage 03 step 6 do not apply.

## 7. The edits

Make exactly these edits. Each "Old" text occurs once in its file. Keep CRLF line endings. Where the new text shows `\u2014`, `\x{2014}`, `\n` or `\r`, write those characters literally (a backslash, then the letters and digits); never write the em dash character itself.

**Warning, seen while writing this spec:** the reviewer's Write tool, and its Bash tool input, turned the six typed characters (backslash, `u`, `2014`) into the em dash character itself. After edit 2, run gate 6 at once. If the whole-file count for `01_spec/CONTEXT.md` is not 0, replace the character with the escape using Node, building both strings from character codes so no tool can convert them: `node -e 'const fs=require("fs");const f=process.argv[1];const D=String.fromCharCode(0x2014),E=String.fromCharCode(92)+"u"+"2014";fs.writeFileSync(f,fs.readFileSync(f,"utf8").split(D).join(E))' workflow/stages/01_spec/CONTEXT.md`. That command keeps CRLF, since it changes nothing else. Then rerun gates 3, 5 and 6.

### Edit 1: `workflow/stages/01_spec/CONTEXT.md`, section 6 (line 39)

Old:

```
With `none`, stage 02 step 4 and stage 03 step 6 do not apply.
```

New:

```
With `none`, stage 02 step 4 and stage 03 step 6 do not apply. When a task only strengthens a test (no non-test file changes), a stash has nothing to remove, so the red run happens inside the test file: the spec gives the order (add the new assertion to the test as it stands, run it, save the failure to `workflow/stages/02_build/output/logs/<id>-red.log`, then complete the test), the failure it must show, and the exact temporary edit that takes the finished test back to its red state, which the reviewer repeats in stage 03 step 6.
```

### Edit 2: `workflow/stages/01_spec/CONTEXT.md`, Rules (a new bullet after line 50, the line-ending rule)

Insert this line directly after the bullet that starts `- A gate that checks line endings`:

```
- A gate that counts em dashes uses Node, never `grep -P '\x{2014}'`, which in the agents' Git Bash stops with "character value in \x{} or \o{} is too large" (exit 2). Count U+2014 in the added lines with `node -e "const o=require('child_process').execSync('git diff -U0 HEAD',{encoding:'utf8',maxBuffer:1<<28});console.log(o.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).join('\n').split('\u2014').length-1)"`, and in whole files (a new untracked file, or the spec itself) with `node -e "for(const f of process.argv.slice(1))console.log(f,require('fs').readFileSync(f,'utf8').split('\u2014').length-1)" <file>...`.
```

### Edit 3: `workflow/stages/02_build/CONTEXT.md`, step 4 (line 25)

Old:

```
they must fail for the reason the spec gives. Skip this step when the spec's tests are `none`.
```

New:

```
they must fail for the reason the spec gives. When the task only strengthens a test, follow the spec's order inside the test file instead: the red run is the new assertion failing before the test is completed, saved to `output/logs/<id>-red.log` and quoted (the command and its failure lines) in the build report's fail-then-pass evidence. Skip this step when the spec's tests are `none`.
```

### Edit 4: `workflow/stages/02_build/CONTEXT.md`, a new paragraph after line 30

Insert one blank line and then this paragraph directly after the paragraph that ends `never write to it again.` (before `## On \`fix <id>\``):

```
When the spec lists `docs/audit/refactor-log.md`, build the phase's entry, or this task's part of it, from the commits and the ledger, never from memory. **Changed:** each committed task's `git show --stat <sha>` and this task's `git status --porcelain`, leaving out `workflow/stages/` files; name no file they do not list. **Verified:** each task's Gate result cell in `docs/audit/task-ledger.md`, copied word for word. **Surprises:** only items a review or build report names. The header keeps its `<sha>` placeholders; the owner's deploy record fills them.
```

### Edit 5: `workflow/stages/03_review/CONTEXT.md`, the Agent line (line 3) and step 6 (line 12)

Two replacements in the same file.

**5a, line 3.** Old:

```
(step 6's stash is the one allowed exception)
```

New:

```
(step 6's stash, or its temporary test edit for a test-only task, is the one allowed exception)
```

**5b, line 12.** Old:

```
6. **Tests:** for each new test, confirm it fails without the change. Skip this step when the spec's tests are `none`.
```

New:

```
6. **Tests:** for each new test, confirm it fails without the change. Skip this step when the spec's tests are `none`. When the task changes no non-test file, there is nothing to stash, and the builder's red log alone is not enough: reproduce the red run yourself. Record `git status --porcelain` and `git diff -- <test file>`; make the temporary edit the spec names in the test file; run the test alone and record the failure the spec gives; undo that edit by hand (never `git checkout` or `git restore`, which would drop the task's changes); then show both outputs are identical to the recorded ones, so `git diff` holds only the task's changes. Steps 6.1 to 6.4 then do not apply.
```

### Edit 6: `workflow/stages/03_review/CONTEXT.md`, step 6.2 (line 14)

Old:

```
   2. Stash only the non-test changes: `git stash push -- <files>`. Never while Playwright runs.
```

New:

```
   2. Stash only the non-test changes: `git stash push -- <files>`. Never while Playwright runs. A staged deletion matches no path, so stash it through its folder's path. Leave out a file that `git ls-files --eol` shows as `w/lf`: under `core.autocrlf` the pop rewrites it to CRLF. Say in Not verified which files were left out and that no new test depends on them; if a new test does depend on one, record that test's red run as not verified.
```

### Edit 7: `workflow/stages/03_review/CONTEXT.md`, step 6.4 (line 16)

Old:

```
   4. `git stash pop`, then show `git status --porcelain` is identical to step 6.1.
```

New:

```
   4. `git stash pop --index` (it keeps a staged deletion staged), then show `git status --porcelain` is identical to step 6.1.
```

### Edit 8: `docs/audit/refactor-log.md`, the Phase 137 entry (lines 22 to 27)

Apply edit 4's rule to T772's own part:

- Line 22, the header: `T769-T771` becomes `T769-T772`. Nothing else on the line changes.
- Line 24, the brief: append one sentence at the end: `T772 adds the rule candidates from the T767, T770 and T771 reviews to the three workflow stage files.`
- Line 26, Changed: append `T772:` then each file from `git status --porcelain` (outside `workflow/stages/*/output/`) with a short note in brackets, in the style of the T770 and T771 parts.
- Line 27, Verified: append `T772:` then T772's Gate result cell from `docs/audit/task-ledger.md`, copied word for word. Fill the ledger cell first.

Lines 28 (Surprises) and 29 (Deliberately not done): change only if this task has a surprise a build report names; otherwise leave them.

## 8. Gates

The docs-only tier: nothing to run, but these docs state commands and paths, so check them against the code. Run in Git Bash and record each result in the build report.

1. **Commands work:** run edit 2's added-lines one-liner: it prints a number and exits 0. Run edit 2's whole-file one-liner on the three stage files: it prints one line per file, each ending in `0`. Run `git diff -U0 HEAD | grep '^+' | grep -cP '\x{2014}'` and record that it still errors (the message edit 2 quotes); if it no longer errors, stop with `BLOCKED`.
2. **Paths exist:** `workflow/stages/02_build/output/logs/` exists; `git ls-files --error-unmatch` succeeds for every file in section 2.
3. **Text landed once:** a Node check that each New text of edits 1 to 7 (both 5a and 5b) occurs exactly once in its file, and each Old text of edits 1, 3, 5a, 5b, 6 and 7 occurs 0 times. Also check that the new step 6 text contains `never \`git checkout\` or \`git restore\`` and `Steps 6.1 to 6.4 then do not apply`, and that the new step 4 text contains `in the build report's fail-then-pass evidence`.
4. **Diff size:** `git diff --numstat` shows `01_spec/CONTEXT.md` 2 added, 1 deleted; `02_build/CONTEXT.md` 3 added, 1 deleted; `03_review/CONTEXT.md` 4 added, 4 deleted; `refactor-log.md` 4 added, 4 deleted; `task-ledger.md` 1 added, 0 deleted.
5. **Line endings:** `git ls-files --eol` shows `w/crlf` for all five files, and a Node count of bare `\n` (a `\n` not preceded by `\r`) prints 0 for each.
6. **Em dashes:** edit 2's added-lines one-liner prints 0, and its whole-file one-liner prints 0 for all five files and for `task-T772-build.md`.
7. **Scope:** `git status --porcelain` lists only the five files above and the T772 stage outputs (`task-T772-spec.md`, `task-T772-build.md`).

## 9. Production touch points

None. No SQL, no `/api/*` request, no deploy, no commit by the builder.

The spec's Target files include `workflow/stages/*/CONTEXT.md`, so by `AGENTS.md`'s pause rule the orchestrator pauses for the owner's go-ahead before sending `build T772`.

## 10. Out of scope

- `AGENTS.md`, `CLAUDE.md` and ADR `0101`: no rule change there.
- Stage 03 step 7 ("zero em dashes in every touched file"): leave its wording as it is, even though edit 2 adds a Node way to count.
- Any rewrite of other refactor-log entries, including Phase 135's or the T769 to T771 parts of Phase 137, to match edit 4's rule.
- Any other line of the stage files, including renumbering steps, and the STATUS line sections.
- `refactor-log.md`'s length (211 lines), already recorded as deliberately not done.
- `baseline-metrics.md`.
