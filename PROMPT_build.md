# Ralph Build Mode

Based on Geoffrey Huntley's Ralph Wiggum methodology.

---

## Phase 0: Orient

Read `.specify/memory/constitution.md` to understand project principles and constraints.

---

## Phase 1: Discover Work Items

Search for incomplete work from these sources (in order):

1. **specs/ folder** — Look for `.md` files NOT marked `## Status: COMPLETE`
2. **IMPLEMENTATION_PLAN.md** — If exists, find unchecked `- [ ]` tasks
3. **GitHub Issues** — Check for open issues (if this is a GitHub repo)
4. **Any task tracker** — Jira, Linear, etc. if configured

Pick the **HIGHEST PRIORITY** incomplete item:

- Lower numbers = higher priority (001 before 010)
- `[HIGH]` before `[MEDIUM]` before `[LOW]`
- Bugs/blockers before features

Before implementing, search the codebase to verify it's not already done.

---

## Phase 1b: Track Attempts (NR_OF_TRIES)

After selecting a spec:

1. Look for `NR_OF_TRIES: N` at the bottom of the spec file
2. If found, increment N; if not found, add `NR_OF_TRIES: 1` at the very bottom
3. If NR_OF_TRIES > 0, check the `history/` folder for notes about previous attempts on this spec
4. **If NR_OF_TRIES = 10:** This spec is unachievable (too hard or too big). Split it into simpler specs and mark the original as superseded

---

## Phase 1c: Re-Verification Mode (No Incomplete Work Found)

**If ALL specs appear complete**, don't just exit — do a quality check:

1. **Randomly pick** one completed spec from `specs/`
2. **Strictly re-verify** ALL its acceptance criteria
3. **If any criterion fails**: Unmark the spec as complete and fix it
4. **If all pass**: Output `<promise>DONE</promise>` to confirm quality

---

## Phase 2: Implement

Implement the selected spec/task completely:

- Follow the spec's requirements exactly
- Write clean, maintainable code
- Add tests as needed

---

## Phase 3: Validate

Run the project's test suite and verify:

- All tests pass
- No lint errors
- The spec's acceptance criteria are 100% met

---

## Phase 4: Record History

Add concise notes to `history/` folder:

- What was learned during this implementation
- Any gotchas or issues encountered
- Decisions made and why

---

## Phase 5: Commit & Update

1. Mark the spec/task as complete (add `## Status: COMPLETE` to spec file)
2. Check off all acceptance criteria: `- [x]`
3. `git add -A`
4. `git commit` with a descriptive message referencing the spec
5. `git push`

---

## Completion Signal

**CRITICAL:** Only output the magic phrase when the work is 100% complete.

Check:

- [ ] Implementation matches all requirements
- [ ] All tests pass
- [ ] All acceptance criteria verified
- [ ] Changes committed and pushed
- [ ] Spec marked as complete
- [ ] History notes recorded

**If ALL checks pass, output:** `<promise>DONE</promise>`

**If ANY check fails:** Fix the issue and try again. Do NOT output the magic phrase.
