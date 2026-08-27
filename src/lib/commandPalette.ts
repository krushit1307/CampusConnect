/**
 * Opens the global Cmd+K command palette from anywhere in the app.
 *
 * The palette (src/components/ui/command-palette.tsx) listens for this custom
 * event on `window`. Used by the mobile navbar search button and any other
 * trigger that should open the palette without synthesizing a keyboard event.
 */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("open-command-palette"));
}
