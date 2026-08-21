import { useEffect, useRef, useState } from "react";
import { getDraft, saveDraft, clearDraft } from "@/lib/draftStorage";

const AUTOSAVE_INTERVAL_MS = 5000;

export function useDraft(key: string, value: string, setValue: (v: string) => void) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const valueRef = useRef(value);
  const isClearingRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Load draft on mount
  useEffect(() => {
    getDraft(key)
      .then((saved) => {
        if (saved && saved.trim()) {
          setDraftContent(saved);
          setHasDraft(true);
        }
      })
      .catch(() => {
        // IndexedDB unavailable or blocked — silently skip restore
      });
  }, [key]);

  // Auto-save every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      if (isClearingRef.current) return;
      if (valueRef.current.trim()) {
        saveDraft(key, valueRef.current).catch(() => {
          // Storage full or unavailable — silently skip
        });
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [key]);

  const restoreDraft = () => {
    if (draftContent) {
      setValue(draftContent);
    }
    setHasDraft(false);
  };

  const discardDraft = () => {
    clearDraft(key).catch(() => {});
    setHasDraft(false);
  };

  const clearSavedDraft = async () => {
    isClearingRef.current = true;
    try {
      await clearDraft(key);
    } catch {
      // Silently ignore
    } finally {
      isClearingRef.current = false;
    }
  };

  return { hasDraft, restoreDraft, discardDraft, clearSavedDraft };
}
