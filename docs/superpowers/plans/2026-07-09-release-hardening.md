# Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove known dependency vulnerabilities, preserve the repository's RLM workflow while updating Ralph Wiggum, and promote the verified `main` release to the documented Coolify branch.

**Architecture:** Dependency changes remain constrained to `package.json` and `package-lock.json`, with source compatibility validated by the existing lint, Vitest, and Vite build gates. Ralph's new root-spec queue helper is imported while the repository-specific RLM flags, trace files, and subcall script remain supported. Coolify is configured to deploy `main`; `master` is fast-forwarded only to keep the documented release branches aligned. Runtime verification is separate from the Cloudflare Access edge gate.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, npm, GitHub Actions, Docker/nginx, Coolify.

---

### Task 1: Resolve vulnerable dependency graph

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Test: `.github/workflows/ci.yml` existing `npm ci`, lint, test, and build steps

- [ ] **Step 1: Capture the pre-change audit baseline**

Run: `npm audit --json > /tmp/mistermaps-audit-before.json || true`

Expected: the report identifies the current direct blockers, including Vite 6.0.x, Vitest 4.0.x, React Router 7.13.x, and React Syntax Highlighter 15.x.

- [ ] **Step 2: Upgrade direct dependencies to their current compatible patched releases**

Run: `npm install -D vite@latest vitest@latest @vitest/coverage-v8@latest && npm install react-router-dom@latest react-syntax-highlighter@latest`

Expected: only `package.json` and `package-lock.json` change; npm refreshes the vulnerable transitive graph.

- [ ] **Step 3: Check source compatibility and fix only concrete breakage**

Run: `npm run lint && npm test && npm run build`

Expected: all three commands pass. If a package upgrade surfaces a type or API break, make the smallest source/test edit required by its error output, then rerun the failed command.

- [ ] **Step 4: Verify remediation**

Run: `npm audit --audit-level=low`

Expected: exit code 0; if npm identifies a non-fixable advisory, document its package and exact remaining severity in the commit message rather than suppressing it.

- [ ] **Step 5: Update GitHub Actions runtimes that emit Node 20 deprecation warnings**

Set `actions/checkout` to `@v7` and `actions/setup-node` to `@v6` in `.github/workflows/ci.yml`.

Expected: CI continues using Node 22 for the project while the actions themselves no longer target the deprecated Node 20 runtime.

- [ ] **Step 6: Commit the isolated dependency update**

Run: `git add package.json package-lock.json && git commit -m "chore: update vulnerable dependencies"`

Expected: one commit contains only dependency manifests and any minimal compatibility edits required by the validation output.

### Task 2: Integrate current Ralph Wiggum without dropping RLM support

**Files:**
- Create: `scripts/lib/spec_queue.sh`
- Modify: `scripts/ralph-loop.sh`
- Modify: `scripts/ralph-loop-codex.sh`
- Modify: `.specify/memory/constitution.md`
- Test: `scripts/ralph-loop.sh`, `scripts/ralph-loop-codex.sh`, `scripts/rlm-subcall.sh`

- [ ] **Step 1: Import the upstream spec queue helper**

Run: `cp /tmp/ralph-wiggum-upstream/scripts/lib/spec_queue.sh scripts/lib/spec_queue.sh`

Expected: the helper provides root-spec discovery and `Status: COMPLETE` detection used by current Ralph loops.

- [ ] **Step 2: Merge upstream queue/model improvements into both loop scripts**

Implementation requirements:

```bash
# In both loop scripts, source the new helper after the logs directory is created.
source "$SCRIPT_DIR/lib/spec_queue.sh"

# Preserve the existing --rlm and --rlm-context parser branches, workspace initialization,
# prompt trace snapshots, output snapshots, and scripts/rlm-subcall.sh integration.
# Add the upstream incomplete-spec count/next-spec reporting without the upstream early-exit,
# because this repository's constitution requires re-verification when all specs are complete.
```

Expected: the scripts retain all documented RLM modes and gain deterministic incomplete-spec reporting.

- [ ] **Step 3: Update the constitution provenance**

Set `Installed Commit` and `Upstream HEAD` in `.specify/memory/constitution.md` to `3f15f0fb83b8c2e0ac8d11abdae0e83ab8204981`, and set `Checked` to `2026-07-09`.

- [ ] **Step 4: Validate all script entry points without starting a loop**

Run: `bash -n scripts/ralph-loop.sh scripts/ralph-loop-codex.sh scripts/rlm-subcall.sh scripts/lib/spec_queue.sh && ./scripts/ralph-loop.sh --help && ./scripts/ralph-loop-codex.sh --help && ./scripts/rlm-subcall.sh --help`

Expected: syntax validation and help rendering pass; no agent loop starts and no prompt/log artifacts are created.

- [ ] **Step 5: Commit the framework integration**

Run: `git add scripts .specify/memory/constitution.md && git commit -m "chore: refresh Ralph workflow helpers"`

Expected: the commit includes only Ralph framework files and provenance.

### Task 3: Publish and release the verified main branch

**Files:**
- Modify: `README.md`
- Modify: remote branch `origin/main`
- Modify: remote branch `origin/master`

- [ ] **Step 1: Re-run the complete local release gate**

Run: `npm run lint && npm test && npm run build && git status --short --branch`

Expected: all checks pass and the branch is clean.

- [ ] **Step 2: Publish main and wait for CI**

Run: `git push origin main && gh run list --branch main --limit 1 --json databaseId,status,conclusion,url`

Expected: remote `main` points to the new commit and its CI run completes successfully.

- [ ] **Step 3: Correct the deployment documentation and publish the configured deployment branch**

Set the README deployment statement to `Push to main triggers automatic deploy`, matching the Coolify application configuration for `justaride/mistermaps`.

Run: `git add README.md && git commit -m "docs: correct Coolify deployment branch" && git push origin main`

Expected: Coolify receives the updated `main` commit.

- [ ] **Step 4: Keep master aligned with the verified release commit**

Run: `git push origin main:master && git ls-remote origin refs/heads/main refs/heads/master`

Expected: `refs/heads/main` and `refs/heads/master` have the same SHA; Coolify deploys the `main` branch.

- [ ] **Step 5: Verify release evidence at each boundary**

Run: `gh run list --branch master --limit 1 --json status,conclusion,url && curl -sSIL --max-time 20 https://mistermaps.gabistudio.dev/ | head -n 20`

Expected: CI on `master` passes and the edge responds with the Cloudflare Access gate. Check Coolify's deployment record and authenticated browser session separately before claiming the app behind Access serves the promoted commit.

- [ ] **Step 6: Commit this plan as the execution record**

Run: `git add docs/superpowers/plans/2026-07-09-release-hardening.md && git commit -m "docs: add release hardening plan"`

Expected: the plan records the exact release procedure used for this promotion.
