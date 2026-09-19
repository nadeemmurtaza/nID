# nID engineering conventions

Read `docs/HOUSE-RULES.md` before adding a module (tenant isolation, provider
pattern) and `docs/PHASES.md` for the delivery roadmap.

## Token discipline (always on)

Apply `.claude/skills/token-saver/SKILL.md` by default on every task in this
repo, without being asked: prefer `Grep`/`Glob` over reading whole files,
read targeted line ranges instead of full files, use `Edit` instead of
rewriting files with `Write`, cap command/search output at the source instead
of dumping it and skimming, batch independent tool calls, and delegate
open-ended multi-file exploration to a subagent instead of absorbing the raw
search traffic into the main conversation. This is a default working habit,
not a mode to opt into — never trade it against correctness (verify, test,
and research fully; just do it without the padding).
