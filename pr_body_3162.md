## Description

This PR implements the "Download My Data" export and Account Portability flow as requested in #3162.
It introduces a dedicated `/settings/data` route where users can:
- Request an export of their personal data (RSVPs, posts, comments, etc.).
- The Supabase Edge Function `request-data-takeout` has been updated to automatically include all of the user's uploaded media files (from `avatars`, `documents`, `photos`, `resumes`, `covers`, and `face-indexing` buckets) in the ZIP archive.
- Review the Data Retention and Deletion policy.
- Access the destructive "Delete All My Data" option, which securely removes all their information from the platform.

---

## Related Issue

* Closes #3162

---

## Component(s) Affected

* [x] Backend (`backend/`, `supabase/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [x] Web app (`web/`, `src/`)
* [ ] Landing page (`landing-page/`)
* [ ] Docs only (README, CONTRIBUTING, architecture, etc.)
* [ ] CI / tooling

---

## Type of Change

* [ ] Bug fix
* [x] New feature
* [ ] Documentation update
* [ ] Refactor (no behavior change)
* [ ] Tests
* [ ] Other:

---

## Testing Performed

### Commands executed
- Verified component functionality in local environment.
- Checked data takeout Edge Function for ZIP creation with `fflate` incorporating all media buffers.
