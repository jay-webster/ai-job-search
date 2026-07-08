# Indeed Jobs URL Reference

Public endpoints used by this skill. No authentication required.

## Search (RSS feed)

```
GET https://www.indeed.com/rss
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `q` | Free-text query | `data engineer` |
| `l` | Location | `New York, NY` · `Remote` · `Austin, TX` |
| `sort` | Sort order | `date` (most recent first) |
| `fromage` | Posted within N days | `1`, `3`, `7`, `14`, `30` |
| `radius` | Search radius in miles | `5`, `10`, `15`, `25`, `50`, `100` |
| `jt` | Job type | `fulltime`, `parttime`, `contract`, `internship`, `temporary` |

Returns an RSS 2.0 XML document. Each `<item>` contains:
- `<title>` — job title (CDATA)
- `<source url="...">` — company name and optional company URL
- `<pubDate>` — posting date (RFC 2822)
- `<description>` — snippet (CDATA, may contain HTML; sometimes includes location as `<b>Location</b>: City, State`)
- `<guid>` — canonical URL containing the job key: `https://www.indeed.com/viewjob?jk=<16-char-hex>&from=rss`
- `<link>` — may be a tracking redirect URL; use `guid` instead for the canonical job URL

Job key (ID) extraction: match `jk=([a-f0-9]{16})` in the `<guid>` value.

## Detail

```
GET https://www.indeed.com/viewjob?jk=<jobkey>
```

Returns a server-rendered HTML page. The job data is embedded as:

```html
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "JobPosting",
  "title": "...",
  "description": "...",
  "datePosted": "YYYY-MM-DD",
  "validThrough": "YYYY-MM-DD",
  "employmentType": "FULL_TIME",
  "hiringOrganization": { "@type": "Organization", "name": "...", "sameAs": "..." },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "City",
      "addressRegion": "State",
      "addressCountry": "US"
    }
  }
}
</script>
```

Fallback: if JSON-LD is absent, the description is in `<div id="jobDescriptionText">`.

## Notes

- RSS feed is paginated via `start` param (0, 10, 20, …) — 10 items per page.
- Use a browser User-Agent to avoid 403 responses on the detail page.
- Indeed may 429 on rapid requests; the CLI backs off on 429/5xx.
