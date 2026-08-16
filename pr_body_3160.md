## Description

This PR implements granular Role-Based Access Control (RBAC) via JSONB permissions for club executives. It enables detailed permission structures using a new JSONB `permissions` column within the `club_roles` table. 

This addresses Issue #3160 by completely replacing the legacy flat role mapping and migrating towards granular capabilities, allowing the system to verify access specifically via `AppPermission` tokens.

---

## Related Issue

* Closes #3160

---

## Component(s) Affected

* [x] Backend (`backend/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [x] Web app (`web/`)
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
* [ ] `flutter analyze` _(not applicable)_
* [ ] `dart format --output=none --set-exit-if-changed .` _(not applicable)_
* [ ] `flutter test` _(not applicable)_
* [ ] `pytest -v`
* [ ] `npm run lint` _(not applicable)_
* [x] `npm run build` _(tested during implementation)_

### Manually verified
* Granular RBAC permissions are correctly verified by `useClubPermissions`.
* UI components for roles and permissions correctly render and validate access.
* The legacy role fallback remains operational for pre-migration data.

### Edge cases considered
* Missing role permissions gracefully fall back.
* Conflict resolution completed with latest upstream main ensuring no regression to `useClubPermissions`.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

No new backend API endpoints were added. The `useClubPermissions` hook relies on Supabase standard querying.

---

## Documentation Updates

* [x] Not applicable
* [ ] Updated `README.md`
* [ ] Updated Project Status table
* [ ] Updated `docs/architecture.md`
* [ ] Updated `.env.example`
* [ ] Added new localization strings

---

## Out of Scope

* No changes to mobile implementation.
* No changes to global site-wide permissions.

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
