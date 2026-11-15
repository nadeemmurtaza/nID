# Unslop Design Rules

Forty binding rules for not looking like generic AI-generated design
— identical across every NEWAX repo, same status as
`CONVENTIONS.md`. Part 1 is twenty concrete fixes; Part 2 is twenty
vocabulary terms this ecosystem's UI work must actually get right,
each with the rule it implies here. Several items restate something
already binding elsewhere — those are cross-referenced, not
duplicated, per this file set's own no-duplication rule.

---

## Part 1 — Twenty ways to unslop a design

1. **Delete filler badges.** No badge/pill/tag added purely for
   visual texture with no real status, category, or count behind it
   — every badge means something, or it doesn't ship.
2. **Drop redundant labels.** No label restating what's already
   obvious from context (a "Name" label directly above a field
   called "Full name," a section titled "Features" listing things
   that are visibly features). If removing the label loses no
   information, remove it.
3. **Unitalicize random words.** Italics are a semantic signal
   (emphasis, a title, a term being defined) — never applied to a
   word or phrase just because it looked more "designed" that way.
4. **Mono only where it's semantically monospace.** A monospace
   font (`--font-mono`) is for code, IDs, tabular data, and anything
   where character alignment matters — never applied to prose or UI
   labels for a "technical" aesthetic with no actual monospace need.
5. **Use the design system, not ad hoc values.** Every color, space,
   radius, and type size comes from `tokens.css`'s custom properties
   — never a literal hex/px value invented in a component. This is
   `tokens.css`'s own stated consumption rule; this item just makes
   it explicit as an unslop check.
6. **Show the actual product.** Same requirement as
   `CONVENTIONS.md`'s design anti-pattern rule 18 — real screenshots
   or a real recording, never a stock photo or abstract illustration
   standing in for the product.
7. **Enlarge the main feature.** The thing the screen/section exists
   to show should be visually dominant — not sized the same as
   everything around it out of a misplaced sense of "balance." This
   is `UX_UI_RULES.md`'s "staging the focus" (item 3) applied
   literally to size.
8. **Group with spacing, not containers.** Related elements get
   pulled together with proximity (less space between them, more
   space around the group) before reaching for a border or
   background to do the same job — spacing is the first grouping
   tool, a visible container is the second.
9. **Make headlines specific.** A headline states the actual thing
   being said, not a vague, swappable-into-any-product line ("Do
   more, faster" tells the reader nothing this product specifically
   does). If a headline would work unchanged on a competitor's
   product, it's not specific enough.
10. **Emphasize the CTA.** The primary action on a screen is visually
    unambiguous — size, color (`--color-accent`), and position all
    point at it — and there is exactly one primary CTA per screen,
    not several competing for the same visual weight.
11. **Add an accent color deliberately.** This ecosystem already has
    one (`--color-accent`, the orange) — use it to mark the one thing
    that matters most on a given screen, not scattered decoratively
    across unrelated elements (which is also what design anti-pattern
    rule 4, "no rainbow coloring," already bans).
12. **Keep icons consistent.** One icon set, one stroke weight, one
    visual style across the entire product — never two icon sets
    (or two weights of the same concept) mixed on the same screen.
    (Which specific icon set is a separate, deliberate decision —
    `CONVENTIONS.md`'s design anti-pattern rule 2 already rules out
    Lucide by name.)
13. **Remove embellishments.** Any decorative element that isn't
    load-bearing for meaning or usability — extra lines, dividers,
    corner flourishes, background texture — gets cut by default.
    Earn decoration with a reason; don't add it to fill space.
14. **Inner radius = outer radius − padding.** When an element with
    rounded corners sits inside a padded container that also has
    rounded corners, the inner element's radius should equal the
    outer radius minus the padding between them (not an arbitrary
    smaller radius, and never a larger one) — this is what makes
    nested rounded shapes look concentric instead of accidental.
15. **Improve text contrast.** Same requirement as
    `COMPLIANCE_AND_ACCESSIBILITY_RULES.md`'s rule 17 — WCAG AA
    minimum, checked against `tokens.css`'s actual pairs in both
    themes.
16. **Wrap headlines properly.** No headline allowed to break with a
    single short word alone on its last line (a widow — see Part 2).
    Use a manual line break or `text-wrap: balance` rather than
    leaving wrapping to chance on a headline that matters.
17. **Align by eye, not just by pixel math.** Optically balance
    elements whose apparent weight differs from their bounding box
    (a triangular icon next to text, a circular avatar in a square
    grid) — mathematically centered isn't always visually centered;
    see "optical centre" in Part 2.
18. **Use tabular numbers for any numbers that update or align in a
    column.** See "tabular numbers" in Part 2 — written once there,
    not repeated here.
19. **Add loading states.** Same requirement as `CONVENTIONS.md`'s
    design anti-pattern rule 21 and `SAAS_UX_PATTERNS.md`'s item 5 —
    cross-referenced here, not restated a third time.
20. **Animate useful feedback, not decoration.** Motion earns its
    place by communicating a real state change (see `UX_UI_RULES.md`
    items 1–12 and "exaggerated feedback," item 10) — never added
    purely because a static screen felt unfinished. If removing an
    animation loses no information about what just happened, it was
    decoration, not feedback.

## Part 2 — Vocabulary and the rule each term implies

21. **Kerning.** The spacing between two specific letter pairs.
    Headline-size type (`--text-2xl` and above) gets its kerning
    checked by eye for awkward pairs (`"VA"`, `"WA"`, a capital
    letter next to a period) — don't trust the font's default kerning
    blindly at display sizes.
22. **Optical centre.** The point that *looks* centered, which isn't
    always the mathematical midpoint — an icon with more visual
    weight on one side (a play triangle, an arrow) gets nudged by eye
    until it reads as centered, rather than trusting a CSS `center`
    that centers the bounding box instead of the shape.
23. **Tabular numbers.** Digits that each occupy the same fixed
    width (`font-variant-numeric: tabular-nums`), required for any
    numbers that sit in a column (a table, a changing counter, a
    price list) so they don't jitter or misalign as digits change —
    this is Part 1 item 18, defined once here.
24. **Layout shift.** Content jumping as the page continues loading
    (an ad, an image, or late data pushing everything below it down).
    Reserve space for anything that loads asynchronously (explicit
    width/height, a skeleton matching the final layout — see
    `CONVENTIONS.md`'s design anti-pattern rule 21) so nothing shifts
    once it arrives.
25. **Tracking.** Uniform letter-spacing applied across a whole run
    of text (as opposed to kerning's pair-by-pair adjustment). Small
    positive tracking on all-caps labels/badges improves legibility;
    body text at default size should not have tracking adjusted
    without a specific reason.
26. **Optimistic update.** Same concept as `SAAS_UX_PATTERNS.md`'s
    item 1 — defined once there, cross-referenced here.
27. **x-height.** The height of lowercase letters without ascenders/
    descenders (the height of "x" itself) — a factor in how large a
    typeface reads at a given font-size. Relevant when swapping or
    pairing typefaces: two fonts at the same declared size with very
    different x-heights will look mismatched in size next to each
    other.
28. **Touch target.** Same concept as `UX_UI_RULES.md`'s item 14
    ("bigger hit areas") and `COMPLIANCE_AND_ACCESSIBILITY_RULES.md`'s
    keyboard/accessibility rules — defined once there.
29. **Leading.** Line-height — the vertical space between lines of
    text (`--leading-tight`/`--leading-normal`/`--leading-relaxed` in
    `tokens.css`). Body text uses `--leading-normal` or looser;
    tight leading is reserved for large display headlines where
    lines are short.
30. **Origin-aware animation.** A thing that opens (a modal, a
    dropdown, a popover) should visually originate from the element
    that triggered it — scaling/fading in from that element's
    position, not materializing from the center of the screen or a
    fixed, unrelated point. See also "shared element transition"
    (item 40) for the stronger version of this.
31. **OKLCH.** A perceptually-uniform color space where lightness
    changes don't accidentally shift perceived hue the way adjusting
    HSL or hex values can. **Flagged, not yet true here:**
    `tokens.css` currently defines every color as a hex literal, not
    OKLCH — generating new color variants (a hover state, a tint) by
    hand-picking a hex value instead of deriving it in OKLCH is a
    known gap, not a standard to follow. Migrating the palette to
    OKLCH is a deliberate design-system decision for whoever owns
    `tokens.css` next, the same way the flagged Inter/drop-shadow
    violations are.
32. **Widow.** A single short word left alone on the last line of a
    paragraph or headline — see Part 1 item 16, defined once here.
33. **Safe area.** The region of a mobile screen not obscured by a
    notch, home indicator, or rounded corners
    (`env(safe-area-inset-*)` in CSS). Any fixed-position UI
    (a bottom nav bar, a floating action button) on a mobile layout
    (see `SAAS_UX_PATTERNS.md` item 18) must respect safe-area insets,
    not just the viewport's raw edges.
34. **Stagger.** A list of items entering with a short, incremental
    delay between each one instead of all at once — makes a list
    feel like it's arriving, not popping in as a block. Keep the
    per-item delay small (well under `--motion-fast`'s 140ms between
    items) so a long list doesn't make the user wait through the
    whole stagger to see the last item.
35. **Line length.** The number of characters per line of body text.
    Target roughly 50–75 characters per line (`--container-sm`/`md`
    widths, not the full viewport) — a line that's too long is tiring
    to track across; too short fragments reading rhythm.
36. **Affordance.** A visual cue that tells the user what an element
    does before they interact with it (a button looks pressable, a
    draggable handle looks grabbable). An interactive element must
    look interactive — no clickable element styled identically to
    static text with no indication it does anything.
37. **Combobox.** A searchable, typeable dropdown — the correct
    pattern once a plain `<select>`'s option list gets long enough
    that scanning it is slower than typing a few characters to
    filter it (ties to `SAAS_UX_PATTERNS.md`'s item 12, advanced
    filtering, applied to a single-field picker).
38. **Interruptible animation.** An in-progress animation must
    respond immediately to new input instead of finishing on rails
    first — a panel sliding closed must reverse immediately if the
    user re-opens it mid-animation, not finish closing and then
    re-open from scratch. An animation a user can't interrupt reads
    as the UI ignoring them.
39. **Progressive disclosure.** Show only what's needed right now;
    reveal more detail/options as the user asks for it, instead of
    everything at once. This is the mechanism behind
    `UX_UI_RULES.md`'s Hick's/Miller's law rules (items 15–16) and
    `SAAS_UX_PATTERNS.md`'s onboarding-data-capture rule (item 15) —
    defined once here as the general term those rules are instances
    of.
40. **Shared element transition.** When navigating between two views
    that both contain a version of the same element (a list thumbnail
    and the detail page's hero image), that element visually morphs
    from one position/size to the other during the transition instead
    of one static screen cutting to another. The strongest form of
    "origin-aware animation" (item 30) — use it wherever the same
    visual element genuinely exists on both sides of a navigation.

---

These rules bind the same way every other file in this set does: no
"just this once," and a template/framework/library default that
violates one of these gets fixed before shipping.
