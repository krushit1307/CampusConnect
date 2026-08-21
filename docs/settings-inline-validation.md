# Settings Inline Validation Feedback

Issue #263 improves the Settings page form validation UX, especially for the profile handle field.

## What changed

- Adds real-time inline validation feedback for the Settings form handle field.
- Adds a 500ms debounced Supabase uniqueness check while the user edits the handle.
- Runs an async uniqueness check again on blur.
- Excludes the current logged-in user's profile row from uniqueness checks.
- Shows `This handle is already taken` when another profile already owns the handle.
- Shows a green check icon when the handle is valid and available.
- Shows a subtle spinner while the async check is running.
- Disables submit while the form is invalid, saving, loading, checking, or blocked by handle availability.
- Adds shared handle constants/helpers in `src/lib/schemas.ts`.
- Adds schema tests for trimming, max length, and shared unavailable-message constant.

## Manual testing

1. Start the app with `npm run dev`.
2. Log in and open the Settings page.
3. Enter an invalid handle such as `a` and confirm the schema error appears inline.
4. Enter a handle with invalid characters such as `user-name` and confirm the inline schema error appears.
5. Enter a handle that belongs to another profile and blur the field.
6. Confirm the spinner appears while checking.
7. Confirm `This handle is already taken` appears inline.
8. Confirm the submit button is disabled while the handle is taken.
9. Enter a unique handle and blur the field.
10. Confirm the green check icon and `This handle is available` feedback appear.
11. Confirm the submit button is enabled only when the full form is valid.
