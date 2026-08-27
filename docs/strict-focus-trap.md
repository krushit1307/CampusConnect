# Issue #2385 — Strict FocusTrap

`FocusTrap` is a dependency-free React wrapper for modal keyboard focus.

Behavior:

- remembers the element that opened the modal;
- focuses an explicit autofocus target or first focusable descendant;
- loops `Tab` from last to first;
- loops `Shift+Tab` from first to last;
- redirects focus that enters from outside the trap;
- focuses the wrapper when there are no focusable descendants;
- returns focus to the original opener on unmount.

`ModalRoot` now wraps registered modal content with this trap.

Manual test:

1. Focus the Event Registration/Register trigger.
2. Open it using Enter/Space.
3. Tab through every field and action.
4. Tab from the last control: focus must return to the first.
5. Shift+Tab from the first: focus must return to the last.
6. Verify a background control never receives focus.
7. Press Escape to close.
8. Verify focus returns to the original Register trigger.

The repository already uses Radix dialog primitives in several places; this change
does not add a new package and applies the strict behavior at the unified modal
renderer boundary.
