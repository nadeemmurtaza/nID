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
  and scanning by eye.
- Set `head_limit` on `Grep` calls that could match broadly (common tokens,
  generic names) instead of eyeballing a huge hit list.

## Read narrowly

`Read` defaults to the whole file. For anything beyond a couple hundred
lines, use `offset`/`limit` to pull the specific region a prior `Grep` hit
pointed at, rather than the full file "to be safe." If you need to
understand a large file's shape first, grep for its top-level
symbols/headings rather than reading it end to end.

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

- Pipe through `grep`/`head`/`tail` instead of dumping full output
  (`git log --oneline -20` beats `git log`, `npm test 2>&1 | tail -50` beats
  a raw failing test run with a huge stack dump repeated per file).
- For `Grep`, set `head_limit` rather than requesting unlimited results and
  discarding most of them yourself.
- Avoid commands whose normal output is inherently huge (full recursive
  `ls -la`, unfiltered `find /`) — scope them first.

## Batch independent work

If several tool calls don't depend on each other's results (reading a few
files, running independent greps), issue them in one message rather than
serially. This isn't primarily about tokens, but it avoids the back-and-forth
overhead of restating context between round trips.

## Delegate large exploration instead of absorbing it

An open-ended search across the codebase ("where does X happen anywhere in
the monorepo," "what are all the callers of Y") pulls a lot of raw material
into context if done inline. Prefer the `Explore` agent (or `general-purpose`
for multi-step research) for this: it returns a synthesized answer, and the
raw grep/read traffic it took to get there never enters the main
conversation's context at all. Reserve inline `Grep`/`Read` for targeted,
few-file lookups where you already have a good idea what you're looking for.

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
