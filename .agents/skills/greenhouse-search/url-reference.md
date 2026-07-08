# Greenhouse Boards API URL Reference

Public, unauthenticated REST JSON API. No authentication required.

## List jobs

```
GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs
```

Returns all open jobs for the company's board. No server-side filtering supported.

Response shape:
```json
{
  "jobs": [
    {
      "id": 7954688,
      "title": "Software Engineer",
      "company_name": "Stripe",
      "location": { "name": "San Francisco, CA" },
      "first_published": "2026-06-02T08:58:57-04:00",
      "updated_at": "2026-06-26T17:05:44-04:00",
      "application_deadline": null,
      "absolute_url": "https://stripe.com/jobs/search?gh_jid=7954688",
      "departments": [{ "id": 295360, "name": "Engineering", ... }],
      "offices": [{ "id": 65234, "name": "San Francisco", ... }]
    }
  ],
  "meta": { "total": 42 }
}
```

Filtering is client-side: fetch all jobs, then filter by title keywords, location substring, or age.

## Job detail

```
GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}
```

Returns the same fields as the list item plus:
- `content` — HTML job description (HTML entities encoded, e.g. `&lt;p&gt;...&lt;/p&gt;`)
- `questions` — application form questions (ignored by this skill)
- `requisition_id` — internal reference

## Company slug lookup

The slug is the path component on `boards.greenhouse.io/<slug>` or the `gh_src` / `gh_jid`
parameter on a company's careers page. Examples:
- `https://boards.greenhouse.io/stripe` → slug `stripe`
- `https://stripe.com/jobs/search?gh_jid=123` → slug `stripe`

## Notes

- No authentication required; the API is public by design.
- No pagination — the list endpoint returns all open jobs.
- No rate limiting observed; the API is intended for career page embeds.
- `content` must be HTML-entity-decoded before stripping tags.
