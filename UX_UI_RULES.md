# UX/UI Rules

Twenty binding principles for how this ecosystem's interfaces move,
respond, and get laid out — identical across every NEWAX repo, same
status as `CONVENTIONS.md`. The first twelve are Disney's animation
principles, adapted from film to interface motion; the last eight are
established UX/interaction laws. Both sets exist for the same reason:
software that feels physical, responsive, and familiar instead of
mechanical, laggy, and surprising.

Read alongside `CONVENTIONS.md`'s "Design anti-patterns — strictly
forbidden, no exceptions" section — that file says what never to use
(drop shadows, hover animations as decoration, soft corner radius,
etc.); this file says how the motion, feedback, and layout that *is*
allowed should actually behave. Where the two overlap, the anti-
patterns file's bans win — e.g. rule 10 below never means "add a
decorative hover glow," which rule 28 of the anti-patterns list bans
outright.

Motion values referenced below are `tokens.css`'s `--motion-fast`
(140ms), `--motion-normal` (220ms), `--motion-slow` (320ms), and the
easing curves `--ease-standard`, `--ease-decelerate`, `--ease-settle`
— never a literal duration or a linear easing in component code.

---

## Animation principles (adapted for interfaces)

1. **Squash & stretch.** Interactive elements should deform slightly
   under direct manipulation so they read as physical, not rigid —
   a button scales down a few percent on press, a dragged card
   compresses slightly at the moment it's grabbed. Convey weight and
   flexibility through a `transform: scale()` on press/release, not
   through a color change alone.
2. **Anticipation (wind-up).** A big state change needs a small
   preparatory beat first, so it doesn't read as a jump cut — a
   button dips slightly before a panel expands, a card lifts a touch
   before it starts to drag. The wind-up is brief (`--motion-fast`)
   and in the opposite direction of the main motion that follows.
3. **Staging the focus.** Every screen or state has exactly one clear
   focal point; everything else recedes (dimmed, blurred, smaller,
   or simply placed with less visual weight) so attention goes
   exactly where it should without the user having to search for it.
   A modal's backdrop dims the page behind it for this reason — that
   dimming is staging, not decoration.
4. **Pose to pose.** Define a transition by its explicit start state
   and explicit end state, then let the motion system interpolate
   between those two fixed poses. Never animate from "wherever the
   element happens to be" or toward an implicit, undefined target —
   both poses must be real, defined states in the component, not
   animation-only values.
5. **Follow through.** Secondary elements settle a beat after the
   primary action lands, instead of every related thing stopping
   dead in the same instant — a dropped card's shadow/elevation
   settles slightly after the card itself stops moving, a list's
   remaining items finish re-flowing just after the removed item
   disappears. Use `--motion-fast` for the trailing settle, after the
   primary motion's `--motion-normal`/`--motion-slow`.
6. **Slow in & slow out.** No linear easing, ever. Every transition
   starts and ends gently and moves fastest in the middle — use
   `--ease-standard` for most UI motion, `--ease-decelerate` for
   something arriving (entering, opening), `--ease-settle` for
   something coming to rest (a dismiss, a snap-back). Picking the
   right one of these three is part of the job, not an afterthought.
7. **Moving in arcs.** Motion that mimics something physical (a
   dragged item, a panel sliding into place, a toast arriving) should
   travel a slight curve, not a rigid straight line or an axis-locked
   step. Pure state changes (a color flip, a text swap) don't need
   this — arcs are for things that move through space.
8. **Secondary action.** A small supporting motion reinforces what
   just happened without competing with the primary feedback — a
   subtle checkmark draw-in after a save confirms the save; it does
   not replace the save confirmation itself, and it never gets more
   visual weight than the primary action it's supporting.
9. **Snappy timing.** Direct-manipulation feedback (a press, a toggle,
   a hover-equivalent focus state) must feel instantaneous —
   `--motion-fast` (140ms) is the ceiling for this category. Reserve
   `--motion-normal`/`--motion-slow` for larger spatial transitions
   (panel open/close, page-level changes). Feedback to a user's direct
   touch that takes longer than ~150ms to start reads as lag, not as
   a design choice.
10. **Exaggerated feedback.** The system's response to an action must
    be unmistakable at a glance — a clear, legible state change
    (icon swap, color shift, motion), not a reaction so subtle it can
    be missed. "Exaggerated" here means *unambiguous signal*, not
    decorative flourish — it does not license a hover glow, a bounce
    added for delight with no informational purpose, or anything
    `CONVENTIONS.md`'s anti-pattern rules 5/28/22 already ban. If a
    user could plausibly ask "did that work?", the feedback wasn't
    exaggerated enough.
11. **Solid drawing (depth stays physically consistent).** Depth and
    elevation cues must follow one consistent system across the whole
    product, never invented per component — this ecosystem's
    `--layer-*` tokens are the single source of stacking order, and
    whatever elevation/shadow treatment eventually replaces the
    flagged drop-shadow tokens in `tokens.css` must apply the same way
    everywhere a given layer appears. A modal is always above a
    toast, or always below it — never either depending on which
    screen you're on.
12. **Overall appeal.** Every screen must read as intentional and
    polished as a whole, not merely correct piece by piece — this is
    the principle that ties 1–11 together. If each element passes
    its own rule but the screen as a whole feels assembled rather
    than designed, it isn't done.

## Interaction & cognition laws

13. **Fitts's law.** The time it takes to reach a target depends on
    its size and its distance from the user's current focus. Primary
    actions are large and placed close to where attention already is
    (e.g. right where a flow naturally ends), not shrunk to fit or
    pushed to a far corner.
14. **Bigger hit areas.** A tap/click target's hit area is generous
    even when its visible icon or label is small — padding is part of
    the target, not just the glyph. Minimum effective hit area is
    44×44px, achieved with padding around a smaller visible element
    where the design calls for a small icon.
15. **Hick's law.** More choices shown at once means slower decisions.
    Menus, nav bars, and button groups show only what's actually
    needed in that moment — don't surface every possible option
    up front when most of them apply to an edge case.
16. **Miller's law.** Working memory holds about 7±2 items
    comfortably. Never present more than roughly seven ungrouped
    items in a list, nav, or option set — beyond that, chunk into
    categories or progressive disclosure instead of one long flat
    list.
17. **Doherty threshold.** Keep perceived response time under ~400ms
    so the system feels like it's keeping pace with the user, not
    making them wait on it. Anything that will genuinely take longer
    needs a skeleton loader immediately (see `CONVENTIONS.md`'s design
    anti-pattern rule 21 — never ship without one) so the *wait*
    doesn't register as the product being unresponsive.
18. **Postel's law.** Be liberal in what you accept, strict in what
    you send. Forms and inputs should tolerate real-world variation
    in what a user types (extra whitespace, alternate date/phone
    formats, mixed case) and normalize it; what this product sends
    onward — to another service, to storage, over the wire — stays
    strictly validated and well-formed regardless of how forgiving
    the input side was.
19. **Jakob's law.** Users bring expectations from every other product
    they've used. Standard interactions (back navigation, form
    layout conventions, platform-standard gestures) should work the
    way they already do everywhere else unless there's a real,
    specific reason to differ — novelty in a basic interaction
    pattern is a cost to relearn, not a feature.
20. **Frequency of use.** The most frequently used actions sit closest
    at hand — fewer taps/clicks, more prominent placement, available
    without opening a menu. Actions used rarely can be buried deeper
    (a submenu, a settings page) without cost, because the user
    wasn't going to reach for them often anyway.

---

These rules bind the same way `CONVENTIONS.md`'s design anti-patterns
do: no exceptions for "just this once," and a conflicting framework or
component-library default gets overridden, not adopted.
