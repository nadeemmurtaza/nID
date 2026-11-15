# SaaS UX Patterns — 20 Patterns Every SaaS Needs

Twenty binding product-UX patterns — identical across every NEWAX
repo, same status as `CONVENTIONS.md`. These are the patterns users
expect from any serious SaaS product; missing one isn't a style
choice, it's a gap users will notice immediately because every
competent competitor already has it.

Two items below already have a fuller treatment elsewhere — this
file points to that instead of restating it, per the "no duplication"
rule these rule files follow:
- **Skeleton Loaders** (item 2) is `CONVENTIONS.md`'s design
  anti-pattern rule 21 ("never ship without skeleton loaders") — same
  requirement, already binding.
- **Graceful Error Recovery** (item 20) is the UI-facing half of
  `PRODUCTION_READINESS_RULES.md`'s "Graceful degradation" (Reliability
  item 20) — that file covers the backend/infra half.

1. **Optimistic UI updates.** When an action's outcome is virtually
   certain (liking a post, checking a box, sending a message), update
   the UI immediately and reconcile with the server response after —
   don't make the user wait on a round-trip for something that's
   going to succeed.
2. **Skeleton loaders.** See `CONVENTIONS.md`'s design anti-pattern
   rule 21 — never a bare spinner or blank screen while data loads.
3. **Command palette.** A keyboard-invoked (`Cmd/Ctrl+K`) search-and-
   act palette for jumping to pages, records, or actions without
   hunting through menus — expected in any SaaS product with more
   than a handful of screens.
4. **Persistent sidebar navigation.** Primary navigation stays visible
   and in a stable position across pages — not re-rendered from
   scratch, not collapsed by default on desktop, not something the
   user has to re-find on every page.
5. **Loading and empty states, both designed.** Every view that can
   be empty (no data yet, a filtered-to-nothing result) has a real,
   designed empty state explaining what's missing and what to do
   about it — not a blank area that looks broken. Pairs with item 2
   for the loading half.
6. **Autosave.** Any form or editor holding non-trivial user input
   saves progress automatically (debounced, see item 7) instead of
   risking loss on a crash, a closed tab, or a forgotten "Save"
   click.
7. **Debouncing.** Input-triggered work (search-as-you-type, autosave,
   validation) waits for a short pause in input before firing, so it
   doesn't run on every keystroke.
8. **Throttling.** Work that happens on a continuous event stream
   (scroll handlers, resize handlers, drag updates) is rate-limited to
   run at most every N milliseconds, not on every single event fired.
9. **Smart form validation.** Validate fields as the user moves past
   them (not only on submit), with specific, actionable error
   messages next to the field that's wrong — never a generic "Form
   has errors" with no indication of which field or why.
10. **Bulk actions on lists.** Any list of records a user might act on
    in volume (delete, archive, export, tag) supports selecting
    multiple and acting on the selection at once — not one-at-a-time
    only.
11. **Reusable data table.** One shared data-table component (sort,
    resize, select, paginate) used everywhere a table appears, not a
    bespoke table reimplemented per screen with inconsistent behavior.
12. **Advanced data filtering.** Any list of real volume supports
    filtering by its actual meaningful fields (status, date range,
    owner, tags) — not just a single free-text search box standing in
    for real filters.
13. **Keyboard shortcuts.** Common actions (save, search, navigate
    between items, dismiss) have a keyboard shortcut, discoverable
    (a shortcuts list, inline hints) rather than hidden — complements
    `UX_UI_RULES.md`'s Fitts's/frequency-of-use rules for the mouse
    case.
14. **Tier-based UI indicators.** When a feature or limit depends on
    the user's plan/tier, the UI shows that clearly at the point of
    use (a badge, a lock icon, an inline upgrade prompt) — never a
    feature that silently fails or does nothing with no explanation
    of why.
15. **Onboarding data capture.** Collect the information needed to
    personalize the product (role, team size, use case) progressively,
    tied to the user actually using the product — not as a multi-step
    wizard the user must complete before touching anything. This is
    the "teach by doing" rule (`CONVENTIONS.md`'s design anti-pattern
    31) applied to data capture: capture context *through* first use,
    don't gate first use behind a questionnaire.
16. **Referral and affiliate pages.** If the product has a referral or
    affiliate program, it has a real, findable page for it (a unique
    link, tracked signups/payouts) — not a program that only exists
    in a support doc nobody can act on.
17. **Custom 404 page.** A broken/missing route shows a real, on-brand
    404 page with a way back into the product (search, a link home) —
    never the framework's default error page.
18. **Mobile-optimized SaaS layouts.** Every core flow works and looks
    intentional at mobile widths, not just "doesn't break" — tables
    that need a different layout on mobile actually get one, not a
    horizontally-scrolling desktop table shrunk down.
19. **Destructive action protection.** Any irreversible action
    (delete, cancel subscription, remove a member) requires explicit
    confirmation that states what will actually be lost — never a
    single click with no confirmation, and never a confirmation so
    generic it doesn't say what's being destroyed.
20. **Graceful error recovery.** When something fails on the client
    (a request errors, a component throws), show a real recovery
    path — a retry action, a clear explanation, a way back — never a
    blank screen or an unstyled crash. This is the UI-facing half of
    `PRODUCTION_READINESS_RULES.md`'s "Graceful degradation"; that
    file covers what the backend does when a dependency fails, this
    is what the user sees when it does.
