# Mister Maps Constitution

> A mapping library and pattern site built with React, TypeScript, and Mapbox/MapLibre. Provides reusable map components, patterns, and examples for developers working with web maps.

**Version:** 1.0.0

---

## Ralph Wiggum

**Source:** https://github.com/fstandhartinger/ralph-wiggum
**Commit:** 22b6c3c4fad47d8e5a5824ac2093b8d58ab057ff
**Installed:** 2026-02-05

### Auto-Update

At session start, check for updates:

1. Run: `git ls-remote https://github.com/fstandhartinger/ralph-wiggum.git HEAD`
2. If hash differs: fetch latest scripts, update this file, inform user

---

## Context Detection

**Ralph Loop Mode** (you're in this if started by ralph-loop.sh):

- Focus on implementation — no unnecessary questions
- Pick highest priority incomplete spec
- Complete ALL acceptance criteria
- Test thoroughly
- Commit and push
- Output `<promise>DONE</promise>` ONLY when 100% complete

**Interactive Mode** (normal conversation):

- Be helpful and conversational
- Guide decisions, create specs
- Explain Ralph loop when ready

---

## Core Principles

### I. Move Fast

Ship quickly, iterate rapidly. Bias toward action over analysis paralysis.

### II. Quality Code

Maintain high code quality — clean, typed, tested. Speed doesn't mean sloppy.

### III. Simplicity

Build exactly what's needed, nothing more. No premature abstractions.

---

## Technical Stack

| Layer     | Technology                       | Notes                         |
| --------- | -------------------------------- | ----------------------------- |
| Framework | React 18 + Vite 6                | SPA with react-router-dom v7  |
| Language  | TypeScript 5.7                   | Strict mode                   |
| Mapping   | Mapbox GL 3.9 + MapLibre GL 5.17 | Dual map engine support       |
| Styling   | Tailwind CSS 4                   | With @tailwindcss/vite plugin |
| Geo Utils | Turf.js 7                        | Spatial analysis              |
| Animation | Framer Motion 12                 | UI transitions                |
| Icons     | Lucide React                     | Icon library                  |
| Linting   | ESLint 9 + typescript-eslint     | With react-hooks plugin       |
| Testing   | (not yet configured)             |                               |

---

## Autonomy

**YOLO Mode:** ENABLED
Full permission to read/write files, execute commands, make HTTP requests.

**Git Autonomy:** ENABLED
Commit and push without asking, meaningful commit messages.

---

## Work Items

The agent discovers work dynamically from:

1. **specs/ folder** — Primary source, look for incomplete `.md` files
2. **GitHub Issues** — If this is a GitHub repo
3. **IMPLEMENTATION_PLAN.md** — If it exists
4. **Any task tracker** — Jira, Linear, etc. if configured

Create specs using `/speckit.specify [description]` or manually create `specs/NNN-feature-name.md`.

Each spec MUST have **testable acceptance criteria**.

### Re-Verification Mode

When all specs appear complete, the agent will:

1. Randomly pick a completed spec
2. Strictly re-verify ALL acceptance criteria
3. Fix any regressions found
4. Only output `<promise>DONE</promise>` if quality confirmed

---

## Running Ralph

```bash
# Claude Code / Cursor
./scripts/ralph-loop.sh

# OpenAI Codex
./scripts/ralph-loop-codex.sh

# With iteration limit
./scripts/ralph-loop.sh 20
```

---

## Completion Signal

When a spec is 100% complete:

1. All acceptance criteria verified
2. Tests pass
3. Changes committed and pushed
4. Output: `<promise>DONE</promise>`

**Never output this until truly complete.**
