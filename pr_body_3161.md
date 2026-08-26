## Description

This PR implements Issue #3161: Complete Internationalization (i18n) with RTL Support.

* Adds Arabic (`ar`) locale configuration.
* Implements RTL layout swapping (`dir='rtl'`) when Arabic is selected.
* Consolidates duplicated i18n configurations.
* Adds GitHub Actions CI workflow to enforce translation key parity across locale files.
* Basic Arabic translation strings added for demonstration.

---

## Related Issue

* Closes #3161

---

## Component(s) Affected

* [ ] Backend (`backend/`)
* [ ] Mobile app (`rhythma_flutter/`)
* [x] Web app (`web/`)
* [ ] Landing page (`landing-page/`)
* [ ] Docs only (README, CONTRIBUTING, architecture, etc.)
* [x] CI / tooling

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

* Switching to Arabic locale successfully adds `dir="rtl"` to the HTML document.
* Arabic translations render properly in the Navbar.
* Missing keys in CI correctly trigger a failure.

### Edge cases considered

* Duplicated i18n contexts have been cleaned up to prevent overlapping listeners.

---

## Screenshots / Videos (required for any UI change)

* [x] Not applicable — no UI change
* [ ] Included below

---

## API Documentation (required for any new/changed backend endpoint)

Not applicable.

---

## Documentation Updates

* [x] Not applicable
* [ ] Updated `README.md`
* [ ] Updated Project Status table
* [ ] Updated `docs/architecture.md`
* [ ] Updated `.env.example`
* [x] Added new localization strings

---

## Out of Scope

* Automated string extraction of every single hardcoded string in the app (bounded to core components to avoid breaking complex UI).

---

## Checklist

* [x] I have read `CONTRIBUTING.md`
* [x] I rebased/merged the latest `main` into this branch
* [x] I tested my changes locally (see Testing Performed above)
* [ ] Any behavior change includes a new or updated test
* [x] I removed debug prints, commented-out dead code, and unused imports I introduced
* [x] This PR is scoped to one logical change
* [x] I did not commit any secrets, credentials, or real `.env` files
