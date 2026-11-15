# Compliance & Accessibility Rules

Eighteen binding requirements for every product surface in this
ecosystem — identical across every NEWAX repo, same status as
`CONVENTIONS.md` and `UX_UI_RULES.md`. These are launch blockers, not
nice-to-haves: a surface that creates accounts, collects data, sends
email, charges money, or renders UI is not considered shippable until
every rule below that applies to it is satisfied. `CONVENTIONS.md`'s
design anti-pattern rules 26/27 already ban shipping without a Terms
of Service or a Privacy Policy — rules 1–2 here are the same
requirement, expanded with what each document and the surrounding
compliance surface actually needs to contain.

---

## Legal documents & consent

1. **Add a Privacy Policy.** Every product that collects any
   personal data (account info, usage analytics, cookies, device
   data) links a real, specific Privacy Policy before that
   collection happens — not a placeholder, not a generic template
   that doesn't actually describe what this product collects and
   why. It must name: what's collected, why, how long it's kept, who
   it's shared with (including third-party SDKs, see rule 5), and how
   a user exercises their rights (see rule 18).
2. **Add Terms of Service.** Every product that creates accounts or
   takes payment links a real Terms of Service document before
   signup/checkout — covering at minimum acceptable use, liability,
   and termination. Same bar as rule 1: specific to this product, not
   boilerplate nobody reviewed.
3. **Add a consent banner.** Before setting any non-essential cookie
   or running any tracking/analytics script, show a consent banner
   that lets the user accept or decline — not a banner that's purely
   informational with no real decline path, and not one that sets
   tracking cookies before the user has responded to it.
4. **Audit every form's consent and data collection.** For every form
   in the product, check two things before it ships: (a) every field
   that implies consent (marketing opt-in, data sharing, terms
   acceptance) is a real, unchecked-by-default checkbox the user must
   actively select — never pre-checked, never implied by submitting
   the form — and (b) the form collects only the fields the feature
   actually needs. If a field's purpose can't be stated in one
   sentence, it's unnecessary data — remove it, don't collect it
   "just in case."
5. **Audit third-party SDKs.** Before adding or keeping any
   third-party SDK (analytics, crash reporting, ads, chat widgets,
   etc.), know exactly what data it collects and where it sends that
   data, and make sure the Privacy Policy (rule 1) actually discloses
   it. An SDK whose data practices aren't known or aren't disclosed
   doesn't ship, regardless of how useful it is.
6. **Get age consent.** Any signup or data-collection flow that could
   be used by a minor gets an explicit age gate (a real date-of-birth
   or age-confirmation step, not a buried checkbox) before account
   creation or data collection proceeds.
7. **If the product collects data from children, add parental
   consent.** Where age consent (rule 6) indicates a user is a child,
   data collection does not proceed on the child's say alone — route
   to a verifiable parental-consent flow (COPPA/GDPR-K style) before
   any of that child's data is collected, and limit what's collected
   from a child account to the minimum the feature needs (same
   principle as rule 4, applied more strictly).
8. **Add a data deletion request option.** Every account-holding
   product gives users a real, discoverable way to request deletion
   of their data (a settings page action, or a documented support
   channel that actually executes deletion) — not "email us and
   maybe we'll get to it," and not a deletion that leaves data behind
   silently.
9. **Add an unsubscribe link to every email.** Every outbound email
   that isn't a strictly transactional, user-triggered message (a
   password reset, a receipt) includes a working, one-click
   unsubscribe link, and unsubscribing actually stops future sends of
   that category.
10. **License every font and image used.** Before using any font or
    image asset, confirm its license actually permits this product's
    use (commercial use, the distribution method, modification if
    applicable) and keep that confirmation traceable (a license file,
    a comment near the asset, an entry in a licenses doc) — don't use
    an asset whose license terms were never checked.
11. **Add real business details.** The product states who actually
    operates it — legal entity name, a real contact method, and a
    physical/registered address where that's legally required for
    this product's jurisdiction — typically in a footer or an
    About/Contact page. Never ship a product with no identifiable
    operator.

## Honesty & dark patterns

12. **Remove dark patterns.** No interface pattern designed to
    manipulate a user into an action they wouldn't otherwise take —
    confirmshaming ("No thanks, I don't want to save money"), forced
    continuity (hard-to-cancel subscriptions), sneaking items into a
    cart, disguised ads, or a decline path that's harder to find than
    the accept path. If a pattern's purpose is to exploit a user's
    inattention rather than inform their choice, remove it.
13. **Remove hidden fees.** Every cost a user will actually pay is
    shown before they commit to paying — no fee that only appears at
    the final payment step, buried in fine print, or added after the
    price was already quoted. The price shown early is the price
    charged, or the difference is disclosed before commitment, not
    after.
14. **Remove fake reviews.** Same principle as `CONVENTIONS.md`'s
    anti-pattern rule 12 (no fake testimonials), stated for reviews
    specifically: never fabricate a review, rating, or review count,
    and never display real reviews in a way that implies a different
    volume or sentiment than what actually exists (cherry-picking
    only five-star reviews while suppressing others, inflating a
    displayed average).
15. **Remove unsupported claims.** Any factual claim in marketing or
    product copy (a statistic, a comparison, a "fastest"/"most
    secure"/"#1" claim) must be something the team can actually back
    up. If no one can point to the basis for a claim, cut the claim —
    don't soften the wording and keep it.

## Accessibility

16. **Add accessibility alt text.** Every meaningful image, icon
    conveying information, and non-decorative graphic has real,
    descriptive alt text — not the filename, not "image," and not
    left empty unless the image is genuinely decorative (in which
    case an empty `alt=""` is the correct choice, not a missing one).
17. **Fix color contrast ratio.** Every text/background and
    icon/background pairing meets WCAG AA contrast (4.5:1 for normal
    text, 3:1 for large text/icons) at minimum. Check this against
    `tokens.css`'s actual semantic color pairs (`--color-ink` on
    `--color-page`, `--color-on-accent` on `--color-accent`, etc.) in
    both the light and dark token sets — a pairing that passes in one
    theme and fails in the other still fails this rule.
18. **Add keyboard navigation.** Every interactive element (button,
    link, form field, custom control) is reachable and operable by
    keyboard alone, in a logical tab order, with a visible focus
    state at every stop. A mouse-only or touch-only interaction path
    is an accessibility bug, not an acceptable gap.

---

These rules bind every future build the same way `CONVENTIONS.md`'s
design anti-patterns and `UX_UI_RULES.md`'s interaction rules do: no
"just this once," and a template, generator, or dependency default
that violates one of these gets fixed before shipping, not shipped
and fixed later.
