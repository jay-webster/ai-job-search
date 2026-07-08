# USAJobs API URL Reference

Official REST API. Free key — register at https://developer.usajobs.gov/apirequest/

## Authentication

Every request requires two headers:
```
Authorization-Key: <your-api-key>
User-Agent: <email-used-to-register>
```

Without these, the API returns 403. Keys are tied to an email address.

## Search jobs

```
GET https://data.usajobs.gov/api/search
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `Keyword` | string | Title/duty/qualification keywords |
| `LocationName` | string | City, state, or zip (e.g. "Washington DC", "90210") |
| `DatePosted` | int | Jobs posted within last N days (1–180) |
| `RemoteIndicator` | bool | `True` = remote positions only |
| `ResultsPerPage` | int | Results per page (default 25, max 500) |
| `Page` | int | Page number (default 1) |
| `PositionOfferingTypeCode` | string | `15317` = permanent, `15318` = temporary |

## Response shape

```json
{
  "SearchResult": {
    "SearchResultCount": 10,
    "SearchResultCountAll": 1234,
    "SearchResultItems": [
      {
        "MatchedObjectId": "777978200",
        "MatchedObjectDescriptor": {
          "PositionTitle": "Software Engineer",
          "OrganizationName": "Drug Enforcement Administration",
          "DepartmentName": "Department of Justice",
          "PositionLocation": [
            { "LocationName": "Washington, District of Columbia" }
          ],
          "PublicationStartDate": "2024-01-15T00:00:00.0000000",
          "ApplicationCloseDate": "2024-02-15T00:00:00.0000000",
          "PositionURI": "https://www.usajobs.gov:443/GetJob/ViewDetails/777978200",
          "QualificationSummary": "Full text of requirements...",
          "PositionRemuneration": [
            {
              "MinimumRange": "94199.0",
              "MaximumRange": "122459.0",
              "RateIntervalCode": "PA",
              "Description": "Per Year"
            }
          ],
          "UserArea": {
            "Details": {
              "JobSummary": "What you'll do...",
              "LowGrade": "13",
              "HighGrade": "13",
              "RemoteJob": "False",
              "Telework": "Yes",
              "WhoMayApply": { "Name": "Open to the public", "Code": "15 - Public" }
            }
          }
        }
      }
    ]
  }
}
```

## Job detail page (HTML)

```
GET https://www.usajobs.gov/GetJob/ViewDetails/{MatchedObjectId}
```

Note: strip `:443` from `PositionURI` for a clean URL.

The HTML page has structured content useful for full description extraction:
- Job title, agency, salary, grade in `<meta>` tags and headings
- Full duties and requirements in `#job-duties` and `#qualifications-required` sections
