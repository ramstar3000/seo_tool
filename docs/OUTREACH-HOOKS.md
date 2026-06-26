# Outreach Hooks — Cold Email Playbook

A bank of subject lines, opening hooks, and full templates for mass-emailing SEO prospects
(local SMBs ranking #3–#4). Built to match the voice already in `lib/leads/outreach-email.ts`:
**specific, rank-anchored, value-first, tiny ask.**

> **Golden rule:** Every email must contain one *true, specific* observation about *their* site.
> Generic = spam = deleted. Our edge is that we can audit them before we email — use it.

---

## The formula (why these work)

1. **Specific observation** — name their rank, keyword, or a real defect (load time, missing title tag).
2. **Imply the cost** — they're losing enquiries to whoever's above them.
3. **Give value free** — link/offer the audit; don't ask permission to help.
4. **Tiny ask** — "want it?" / "worth a look?" — not "book a 30-min call."

Variables to merge per lead: `{business}`, `{keyword}`, `{location}`, `{rank}`, `{competitor}`,
`{finding}`, `{metric}`, `{audit_url}`.

---

## Subject lines (A/B these)

Keep them lowercase-ish and human — they should look like a 1:1 note, not a campaign.

| # | Subject | Best for |
|---|---------|----------|
| 1 | `Quick note on "{keyword}" — you're #{rank}` | Default. From the codebase. Proven format. |
| 2 | `{business} is one spot from page-1 top results` | Near-miss rankers (#3–#4). |
| 3 | `{competitor} is outranking you on "{keyword}"` | Competitive trigger — high open rate. |
| 4 | `Found 3 things slowing {business} down` | When you have speed/CWV findings. |
| 5 | `your homepage on mobile ({metric})` | Lead with a hard number. |
| 6 | `2-min audit of {business}` | Low-friction, curiosity. |
| 7 | `{location} "{keyword}" — quick observation` | Hyper-local feel. |
| 8 | `re: {business}` | Pattern-interrupt. Use sparingly; must over-deliver in body. |

**Avoid:** "Grow your business", "Boost your SEO", "Digital marketing services", anything with 🚀,
ALL CAPS, or the word "free" in the subject (spam filters + cheapens it).

---

## Opening hooks (first line — the make-or-break)

Pair any of these with a subject above.

- **Rank hook:** `I noticed {business} sits at #{rank} for "{keyword}" in {location}.`
- **Competitor hook:** `You're at #{rank} for "{keyword}" — {competitor} is just above you, and the gap is smaller than it looks.`
- **Defect hook:** `I ran a quick scan of {business} and your {finding} is the main thing keeping you off the top spot.`
- **Speed hook:** `Your homepage takes {metric} to load on mobile — Google flags anything over 2.5s, and it's likely costing you rankings.`
- **No-website hook:** `You're ranking for "{keyword}" without much of a web presence — that's actually a big opportunity.`
- **Genuine-compliment hook:** `{business} clearly has the reviews and reputation to rank #1 for "{keyword}" — the site just isn't backing it up yet.`

---

## Full templates

### Template A — "Pre-audited" (our highest-leverage play)
*Use when you've already run an audit and can link it. This is the unfair advantage.*

```
Subject: Quick note on "{keyword}" — you're #{rank}

Hi there,

I noticed {business} sits at #{rank} for "{keyword}" in {location}, just below
the businesses pulling in most of the clicks.

I ran a quick scan — here's what I found: {audit_url}
The biggest one: {finding}.

Happy to walk you through the other fixes. Want me to send them over?

[Your name]
```

### Template B — "Light touch" (no audit link yet)
*Matches the current `buildOutreachEmail()` output. Use for volume sends.*

```
Subject: Quick note on "{keyword}" — you're #{rank}

Hi there,

I noticed {business} at #{rank} for "{keyword}" in {location}. {finding}

Happy to send a free audit — want it?

[Your name]
```

### Template C — "Competitor gap"
*Use when you know who ranks above them.*

```
Subject: {competitor} is outranking you on "{keyword}"

Hi there,

Quick one — {competitor} is sitting above {business} for "{keyword}" in {location}.
From a quick look, it's coming down to {finding}, which is very fixable.

Want a free 2-minute audit showing exactly where the gap is?

[Your name]
```

### Template D — "Speed / Core Web Vitals"
*Use when PageSpeed findings are strong.*

```
Subject: your homepage on mobile ({metric})

Hi there,

{business}'s homepage takes {metric} to load on mobile. Google treats anything
over 2.5s as poor, and it's one reason you're at #{rank} for "{keyword}" instead
of higher.

I can send you the full breakdown (free) if useful — worth a look?

[Your name]
```

---

## Follow-ups (where most replies actually come from)

~80% of replies come *after* the first email. Send 2–3, spaced out, each adding value —
never just "bumping this."

**Follow-up 1 (Day 3) — add a finding:**
```
One more thing I spotted on {business}: {finding}. Small fix, real impact on "{keyword}".
Still happy to send the full audit — just say the word.
```

**Follow-up 2 (Day 7) — social proof / soft close:**
```
I help {location} {vertical} climb from page-1-bottom to the top few spots.
If now's not the time, no worries — want me to send the audit so you have it for later?
```

**Follow-up 3 (Day 14) — break-up:**
```
I'll stop here so I'm not cluttering your inbox. If ranking higher for "{keyword}"
becomes a priority, the free audit offer stands. All the best with {business}.
```

---

## Deliverability checklist (before any mass send)

Cold email at volume gets you blocked fast if you skip this.

- [ ] **Use a separate sending domain** (e.g. `try-synapsecro.com`), not your primary — protects your real domain's reputation.
- [ ] **SPF, DKIM, DMARC** configured on the sending domain.
- [ ] **Warm up** the domain/inbox — ramp from ~20/day to higher over 2–3 weeks. Don't blast 500 on day one.
- [ ] **Plain-text feel** — minimal HTML, no images, no tracking pixels, one link max. Looks 1:1, lands in inbox.
- [ ] **Real, working unsubscribe / opt-out line** (legal requirement; also builds trust). UK PECR/GDPR: B2B cold email is allowed but must offer opt-out and be relevant.
- [ ] **Personalize the first line per lead** (the `{finding}` merge) — identical bodies trip spam filters.
- [ ] **Cap volume per inbox** (~30–50/day per address). Scale with more inboxes, not more per inbox.
- [ ] **Send from a real human name**, real signature, real reply-to.

---

## Wiring notes (what to build to send these)

Currently `buildOutreachEmail()` only **builds a string** copied to the clipboard — there is **no send path**.
To mass-send, you need to connect:

1. **Send path:** loop leads → `buildOutreachEmail()` → Resend (already integrated for the
   audit-complete email in `lib/email/send-audit-complete.ts`) → mark lead `status = 'contacted'`.
2. **Merge the `{finding}`:** pull `lead.recommendation` / top audit finding into the body so each
   email is genuinely specific (don't send Template B's generic line at scale).
3. **Throttle + warm-up:** batch sends, respect per-inbox caps (see deliverability checklist).
4. **Reply handling (Stage 2 trigger):** there is currently **no inbound listener**. To make
   "interested → full analysis" autonomous you'd need an inbound webhook (Resend inbound / a parse
   route) that flips `status = 'interested'` and fires `runResearchAgent`.

See `lib/leads/outreach-email.ts`, `lib/email/send-audit-complete.ts`, and `app/leads/page.tsx`.
