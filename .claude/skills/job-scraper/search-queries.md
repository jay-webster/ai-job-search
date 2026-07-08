# Job Scraper Config — Jay Webster

## Location

```
PRIMARY_LOCATION=Cincinnati, OH
REMOTE=true
```

Acceptable locations: Cincinnati metro, San Francisco Bay Area, Chicago, New York, Remote.

---

## Query Keywords

Priority order. `/scrape` runs P1–P3 by default; `/scrape broad` runs all four.
`/scrape [focus]` overrides everything with your focus term.

```
KEYWORDS_P1=Chief Technology Officer
KEYWORDS_P2=Chief Product Officer agentic AI
KEYWORDS_P3=President General Manager B2B SaaS
KEYWORDS_P4=Chief Product and Technology Officer AdTech MarTech
```

### Notes on keyword choices
- P1 targets Jay's current title track (CTO at AdRoll)
- P2 adds "agentic AI" to surface companies specifically building in that space
- P3 catches President/GM mandates — Jay has held these at Choose Energy and Cision
- P4 catches the hybrid CPTO title and domain-specific roles

---

## Greenhouse Target Companies

All checked on every `/scrape` run. Focused on AdTech, AI-native SaaS, and
growth-stage companies where a CTO/CPO/CPTO would be a strong fit.

```
GREENHOUSE_COMPANIES=
  # AdTech / MarTech — verified slugs
  doubleverify
  pubmatic
  braze
  amplitude
  iterable
  klaviyo

  # AI-native / agentic — verified slugs
  anthropic
  gleanwork

  # General high-growth SaaS — verified slugs
  carta
  brex
  stripe
  notion
  figma
  lattice
  rippling

  # Unverified — may need slug correction:
  # thetradedesk (check: thetradedesk)
  # criteo (check: criteo)
  # meltwater (check: meltwater)
  # sprinklr (check: sprinklr)
  # cohere (check: cohere-ai)
  # harvey (check: harveyai)

  # Add your own targets:
  # [slug]
```

Keyword filter applied to all Greenhouse results (client-side title match):

```
GREENHOUSE_QUERY=chief
```

This surfaces CTO, CPO, CPTO, Chief of Staff, Chief Revenue Officer — scan the
table and filter by judgment. Change to a specific title if you want tighter results.

---

## USAJobs (Federal Government)

Less likely to be primary focus, but included for completeness. Defense/intelligence
tech agencies do hire senior technology executives.

```
USAJOBS_KEYWORDS=Chief Technology Officer
USAJOBS_JOBAGE=14
```

Set `USAJOBS_KEYWORDS` to empty to skip USAJobs on a given run.

---

## Date Filter

```
DEFAULT_JOBAGE=14
```

---

## What to fill in before first `/scrape`

The keywords and companies above are ready to use. The only things left to
personalize are the three open sections in `CLAUDE.md`:

1. **Behavioral Profile → Growth areas** — add 1–2 honest self-assessments
2. **What Excites You** — add what you actually want in the next chapter
3. **Deal-breakers** — hard constraints (role level, industry, geography, comp floor)

These feed the fit assessment Claude runs on every result.
