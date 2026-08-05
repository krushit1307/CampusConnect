import { useEffect, useRef, useState } from "react";
import { getDraft, saveDraft, clearDraft } from "@/lib/draftStorage";

const AUTOSAVE_INTERVAL_MS = 5000;

export function useDraft(key: string, value: string, setValue: (v: string) => void) {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Load draft on mount
  useEffect(() => {
    getDraft(key).then((saved) => {
      if (saved && saved.trim()) {
        setDraftContent(saved);
        setHasDraft(true);
      }
    });
  }, [key]);

  // Auto-save every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      if (valueRef.current.trim()) {
        saveDraft(key, valueRef.current);
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
    clearDraft(key);
    setHasDraft(false);
  };

  const clearSavedDraft = () => {
    clearDraft(key);
  };

  return { hasDraft, restoreDraft, discardDraft, clearSavedDraft };
}
