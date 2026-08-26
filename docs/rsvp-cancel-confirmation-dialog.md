# RSVP Cancel Confirmation Dialog

Issue #426 adds a custom confirmation dialog before cancelling an existing RSVP.

## Changed behavior

- Clicking RSVP for a new event still registers immediately.
- Clicking the RSVP button when the user is already registered opens a confirmation dialog.
- The cancel mutation only runs after the user confirms.
- Closing the dialog or clicking `Keep RSVP` leaves the registration unchanged.

## Files changed

- `src/components/EventCard.tsx`
- `src/components/events/EventRsvpCancelDialog.tsx`
- `src/components/events/EventRsvpCancelDialog.test.tsx`

## Manual testing

1. Start the app with `npm run dev`.
2. Sign in and open the Events page.
3. Find an event where you are not registered.
4. Click RSVP and confirm it registers immediately.
5. Click the same RSVP button again.
6. Confirm the dialog asks: `Are you sure you want to cancel your RSVP?`
7. Click `Keep RSVP` and confirm the RSVP remains active.
8. Click the RSVP button again and choose `Yes, cancel RSVP`.
9. Confirm the RSVP is cancelled only after confirmation.
10. Confirm the dialog matches the CampusConnect neubrutalist style.
