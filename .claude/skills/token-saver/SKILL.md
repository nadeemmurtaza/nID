---
name: token-saver
description: Concrete token- and context-conservation techniques for working in this repo — batching tool calls, preferring Grep/Glob over full-file reads, capping command and search output, delegating broad exploration to subagents, and avoiding redundant re-reads or rewrites. Consult this whenever a task touches many files, runs a command that could print a lot, does a multi-file refactor, or involves any open-ended search — not only when someone explicitly asks to "save tokens." These are the default working habits for this repo, applied automatically without being asked.
---

# Token saver

Every token spent on a file you didn't need, a command's unfiltered output, or
a re-read of something already in context is a token not available for the
actual problem. None of this trades away correctness — it's the same work,
done without paying for scaffolding.

## Find before you read

`Grep`/`Glob` cost a fraction of what a `Read` of every candidate file costs.
Never open files one by one to "see which one has X" — search for X first,
then read only the file(s) that matched, and only the region that matched.

- Use `Grep` with `output_mode: "files_with_matches"` to locate candidates,
  `"content"` with `-C`/`-A`/`-B` for a few lines of surrounding context —
  not the whole file.
- Use `Glob` to find files by name/path pattern instead of listing directories
  and scanning by eye. E.g. to find every controller: `Glob("apps/api/src/**/*.controller.ts")`,
  not `Read`-ing `apps/api/src/modules` module by module.
- Set `head_limit` on `Grep` calls that could match broadly (common tokens,
  generic names) instead of eyeballing a huge hit list — e.g. searching for
  `tenantId` or `VerificationSession` across the repo will hit dozens of
  files; start with `head_limit: 20` and widen only if the answer isn't
  there yet.
- Never grep or read inside `node_modules`, `.next`, `dist`, or `pnpm-lock.yaml`
  (8,200+ lines) to answer a code question — the answer is in `apps/*/src`
  or `packages/*/src`. If you need a dependency's version, `Grep` the
  top-level `package.json` files, not the lockfile.

## Read narrowly

`Read` defaults to the whole file. This repo has files where that's fine
(most controllers/services are under 200 lines) and files where it's
wasteful:

- `packages/db/prisma/schema.prisma` is 1,000+ lines. To check one model's
  fields, `Grep -n "^model VerificationCase"` first, then `Read` with
  `offset`/`limit` around that line — don't read the whole schema to find
  one model.
- `docs/PHASES.md` (1,400+ lines) and `README.md` (370+ lines) are reference
  docs organized by section. `Grep` for the heading or keyword you need
  (e.g. `"## Badges"`, `"OAuthLoginRequest"`) and read the matched region,
  not the whole file, unless you genuinely need the full roadmap context.
- Any file a `Grep` hit pointed you at: read the hit's line ± ~40 lines
  first (`offset`/`limit` around the match), not the entire file — widen
  only if that region doesn't answer the question.

Once you've read or edited a file in this session, its state is known —
don't re-`Read` it to confirm an `Edit`/`Write` succeeded; the tool already
errors loudly if it didn't.

## Prefer Edit over Write for existing files

`Edit` sends a targeted diff. Rewriting a whole file with `Write` costs
tokens proportional to the file's full size on every change, not just the
part that changed. Reserve `Write` for new files or genuine full rewrites.

## Cap command output at the source

Don't run a command and then mentally (or literally) skim past noise —
filter before it reaches the transcript:

- Pipe through `grep`/`head`/`tail` instead of dumping full output —
  `git log --oneline -20` beats `git log`; scope `pnpm test` to one
  workspace (`pnpm --filter @nid/api test`) instead of running the whole
  monorepo suite when only one package changed; pipe a failing run through
  `| tail -60` instead of pasting the full Jest/Vitest output with every
  passing suite listed.
- For `Grep`, set `head_limit` rather than requesting unlimited results and
  discarding most of them yourself.
- Avoid commands whose normal output is inherently huge (`ls -laR`,
  unfiltered `find .`, `pnpm install` with full dependency tree logging,
  `prisma migrate dev` with verbose SQL echo) — scope or quiet them first.
- Never `cat`/print an entire migration file under
  `packages/db/prisma/migrations/` or the full `pnpm-lock.yaml` to check
  one detail — `Grep` for the table/column/package name instead.

## Batch independent work

If several tool calls don't depend on each other's results (reading a few
files, running independent greps), issue them in one message rather than
serially. This isn't primarily about tokens, but it avoids the back-and-forth
overhead of restating context between round trips.

## Delegate large exploration instead of absorbing it

An open-ended search across the codebase pulls a lot of raw material into
context if done inline. As a rule of thumb: if answering the question would
take more than ~3 `Grep`/`Read` round trips, or touches more than one of
`apps/*`/`packages/*` at once, delegate it instead of doing it inline.

Examples specific to this repo's shape:
- "How is tenant isolation enforced end to end?" spans
  `packages/db/prisma/migrations/000_init`, `packages/db/src/index.ts`, and
  `apps/api/src/core/db/prisma.service.ts` — a `general-purpose` or
  `Explore` agent should trace it and report back, not three separate
  inline reads stitched together in the main conversation.
- "Which providers implement `VerificationMethodProvider`?" means grepping
  every file under `packages/verification-providers/src` plus the registry
  — delegate to `Explore` rather than opening each provider file in turn.
- A single "where is `X` defined" lookup, or checking one known file,
  stays inline — delegating a one-grep question just adds round-trip
  overhead for no savings.

Prefer `Explore` for locate-and-report tasks, `general-purpose` when the
task also requires judgment across what's found (e.g. "does every
tenant-owned table have an RLS policy?").

## Don't regenerate what's already known

- Don't re-fetch or re-derive information already established earlier in the
  conversation (a file's contents you already read, a decision already
  made, a search result already returned).
- Don't create scratch notes, summaries, or planning docs as files unless
  asked — thinking through a problem doesn't need to be persisted to disk
  and then re-read.
- Don't pad responses with restated context, headers, or preambles the user
  didn't ask for; say the result, not the process of getting to it.

## When it's fine to spend

None of this is a reason to guess instead of verifying, skip a needed test
run, or give an under-researched answer to save tokens — a wrong answer that
has to be redone costs far more than the read it skipped. The goal is
precision (read/search exactly what's needed), not stinginess (avoiding
verification that's actually required).
