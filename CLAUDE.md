# CLAUDE.md — Operating Guidelines for AI Agents

> **Audience:** Every AI agent (Claude Code or otherwise) that touches this repository.
> **Status:** Mandatory. Read in full before taking any action.
> **Owner:** Project maintainer.

These guidelines override default agent behavior. If any other instruction conflicts with them, these rules win. If something is ambiguous, **ask before acting** — do not guess.

---

## The Four Rules

### 1. Understand the system before you change it

Before writing or modifying a single line of code, you must build a real mental model of:

- **What Dealer Co-Pilot does** — the product, its users, and the problem it solves.
- **How it is structured** — backend (Supabase: PostgreSQL + Edge Functions), frontend (React + TypeScript + Tailwind + Vite), scraper services (`playwright-scraper-service/`, `python-scraper-service/`), and how they talk to each other.
- **What the active vs. legacy surface area is** — code under `legacy/` and `archive/` is intentionally frozen and must be ignored unless the task is explicitly about legacy code.
- **Where the current task fits** — which page, edge function, table, or service is actually involved.

**Required reading order before touching code:**
1. [SYSTEM_GUIDELINES.md](SYSTEM_GUIDELINES.md) — single source of truth for architecture.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — deeper architectural detail.
3. [README.md](README.md) — setup, conventions, and product context.
4. The specific files you intend to edit, plus their direct callers and call sites.

If you cannot articulate, in one paragraph, *what the system does and how the piece you're editing fits into it*, you are not ready to make changes. Stop and read more.

### 2. Change only what is strictly necessary

Minimum-viable diff. Always.

- Do **not** refactor code that is not part of the requested change.
- Do **not** "clean up" formatting, rename variables, or restructure files opportunistically.
- Do **not** introduce new abstractions, helpers, or layers unless the task explicitly requires them.
- Do **not** add features, flags, or options that were not asked for.
- Do **not** delete or rewrite code you don't fully understand — flag it instead.
- Prefer editing existing files over creating new ones.

If you notice unrelated issues worth fixing, **list them in your response** so the user can decide. Do not silently expand scope.

### 3. Security is non-negotiable

Treat every change as if it will ship to production tomorrow. Specifically:

- **Never** introduce backdoors, debug bypasses, hardcoded credentials, test users with elevated privileges, or "temporary" auth shortcuts.
- **Never** commit secrets, API keys, service-role keys, tokens, `.env` contents, or anything that looks like one. If you see one already committed, flag it immediately.
- **Always** respect Row-Level Security (RLS) on Supabase tables. Do not disable RLS or add overly permissive policies to make something work — fix the query or the policy properly.
- **Always** prefer the `anon` key + RLS over the `service_role` key on the client. The service-role key must never reach the browser.
- **Always** validate and sanitize external input — scraper outputs, form inputs, URL parameters, edge-function payloads.
- **Always** check authentication and authorization on every edge function and every privileged action. Do not trust the client.
- **Never** log sensitive data (tokens, full PII, passwords) — not in `console.log`, not in error messages returned to clients.
- **Always** parameterize SQL. Never string-concatenate user input into queries.
- **Always** consider OWASP Top 10 (injection, broken auth, XSS, SSRF, IDOR, etc.) when reviewing your own diff before reporting done.
- If a change touches auth, RLS, edge-function permissions, scraper input handling, or any boundary between trusted and untrusted data, **stop and explicitly call this out** in your response with a brief threat-model note.

If you spot an existing security issue while working on something else, surface it — do not quietly fix it inside an unrelated PR (that hides the change), and do not ignore it.

### 4. Recommend best practices and ask clarifying questions

You are expected to be a senior collaborator, not a stenographer.

- When the requested approach has a meaningfully better alternative (clearer code, safer, more idiomatic, better performance, more maintainable), **say so** — present the trade-off in 2–3 sentences and let the user choose.
- When a request is ambiguous (which page? which table? which user role? client-side or server-side?), **ask** before implementing. A 30-second clarification beats a 30-minute wrong implementation.
- When you find conflicting conventions in the codebase, ask which to follow rather than picking arbitrarily.
- When the task could reasonably be interpreted multiple ways and the wrong interpretation would require a rewrite, ask.
- When a task touches security, data integrity, or destructive operations (migrations, deletes, schema changes), confirm intent before executing — even if the user previously authorized similar work in a different context.

Best-practice defaults to follow unless told otherwise:
- TypeScript strict mode; no `any` without a written justification.
- Pure, small functions; clear naming; no dead code.
- Errors handled at boundaries; do not swallow exceptions.
- Database changes go through Supabase migrations, never ad-hoc SQL against prod.
- UI changes are tested in the browser, not just type-checked.

---

## How agents should start every task

1. Read [SYSTEM_GUIDELINES.md](SYSTEM_GUIDELINES.md) and the relevant section of the codebase.
2. Restate the task in your own words and identify which files/components are involved.
3. If anything is unclear, ask before acting.
4. Plan the smallest possible change.
5. Flag any security implications explicitly.
6. Implement, then review your own diff against Rules 2 and 3 before reporting done.
7. Summarize what changed, what you deliberately did **not** change, and any follow-ups the user should consider.

---

## Acknowledgment

By acting in this repository, you agree to operate under these four rules. Violating them is a regression, regardless of whether the code works.
