import { useEffect, useState } from "react";

/**
 * Tracks whether the document currently has a non-empty text selection.
 *
 * Used to make custom right-click context menus (e.g. Radix `<ContextMenu>`)
 * step aside when the user is actively highlighting text, so the browser's
 * native "Copy" menu appears instead of our custom one. Without this,
 * globally intercepting `contextmenu` makes it impossible to copy selected
 * text — a common and frustrating regression.
 */
export function useHasTextSelection(): boolean {
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleSelectionChange = () => {
      const selection = window.getSelection?.();
      setHasSelection(Boolean(selection && selection.toString().length > 0));
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    // Capture any selection that already existed before this hook mounted.
    handleSelectionChange();

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  return hasSelection;
}
