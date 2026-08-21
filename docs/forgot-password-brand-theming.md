# Forgot Password Brand Theming

Issue #400 updates the Forgot Password page so it feels consistent with the
CampusConnect login, registration, and landing page experience.

## Changed file

- `src/routes/forgot-password.tsx`

## What changed

- Centered the forgot password form in a neubrutalist card.
- Added thick black `neu-border` styling.
- Added brand background accents using `bg-cream`, `bg-peach`, and `bg-lime`.
- Added brand typography with `font-display`, `font-mono`, and `eyebrow`.
- Added responsive two-column desktop layout.
- Added compact single-column mobile layout.
- Improved the success confirmation card.
- Improved inline error styling.
- Kept the existing Supabase password reset flow unchanged.
- Preserved account-enumeration-safe success messaging.

## Manual testing

1. Start the app with `npm run dev`.
2. Open `/forgot-password`.
3. Confirm the form appears centered inside a thick-bordered neubrutalist card.
4. Confirm brand colors appear in the background and helper cards.
5. Submit an invalid email and confirm the inline error follows the brand style.
6. Submit a valid email and confirm the success state appears in a branded card.
7. Resize to mobile width and confirm the layout remains readable.
8. Confirm the “Back to sign in” and “Sign in” links work.
