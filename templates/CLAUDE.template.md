# Job Application Assistant for {{CANDIDATE_NAME}}

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for {{CANDIDATE_NAME}}, helping with:
1. **Job fit evaluation** - Assess job postings against your profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt existing CV templates (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using existing templates (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## Candidate Profile

### Identity
- **Name:** {{CANDIDATE_NAME}}
- **Location:** {{LOCATION}} (open to remote or relocation for the right opportunity)
- **Phone:** {{PHONE}}
- **Email:** {{EMAIL}}
- **LinkedIn:** {{LINKEDIN_URL}}
- **Languages:** {{LANGUAGES}}
- **Status:** {{STATUS}}
- **LinkedIn headline:** "{{LINKEDIN_HEADLINE}}"

### Education
{{EDUCATION}}

### Professional Experience
{{PROFESSIONAL_EXPERIENCE}}

### Technical Skills
- **Primary:** {{PRIMARY_SKILLS}}
- **Secondary:** {{SECONDARY_SKILLS}}
- **Domain:** {{DOMAIN_EXPERTISE}}
- **Tools/Platforms:** {{TOOLS_AND_PLATFORMS}}

### Patents
{{PATENTS}}

### Awards
{{AWARDS}}

### Career Highlights
{{CAREER_HIGHLIGHTS}}

### Behavioral Profile
- **Driver type:** {{BEHAVIORAL_DRIVER_TYPE}}
- **Entrepreneurial tendency:** {{ENTREPRENEURIAL_TENDENCY}}
- **Strengths:** {{STRENGTHS}}
- **Growth areas:** {{GROWTH_AREAS}}
- **Thrives in:** {{THRIVES_IN}}

### What Excites You
{{WHAT_EXCITES_YOU}}

### Target Sectors
{{TARGET_SECTORS}}

### Deal-breakers
- **Role level:** {{ROLE_LEVEL_REQUIREMENT}}
- **Company type:** {{COMPANY_TYPE_REQUIREMENT}}
- **Compensation:** {{COMP_FLOOR}}
- **Geography (US):** {{US_GEOGRAPHY}}
- **Geography (International):** {{INTL_GEOGRAPHY}}

---

## Repo Structure
- `cv/` - LaTeX CV variants (moderncv template, banking style)
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools
- `dashboard/` - Local web dashboard for browsing and tracking job leads

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and your strengths

**Important:** When mentioning agentic coding or AI tooling in CVs/cover letters, explicitly reference **Claude Code** by name.

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match actual profile (CLAUDE.md / candidate profile) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims verified independently - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)

### Consistency
- [ ] CV follows the standard 2-page moderncv/banking format
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Agentic coding / AI tooling references mention **Claude Code** by name
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output.
- [ ] CV compiled with **lualatex**. Cover letter compiled with **xelatex**.
- [ ] **CV is exactly 2 pages**
- [ ] **No orphaned `\cventry` titles**
- [ ] **Cover letter is exactly 1 page**
