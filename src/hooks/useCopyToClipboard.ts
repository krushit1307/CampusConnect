import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_DURATION_MS = 2000;

function copyWithLegacyFallback(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (!document.body) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";

  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    let didCopy = false;

    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        didCopy = true;
      } catch {
        didCopy = copyWithLegacyFallback(text);
      }
    } else {
      didCopy = copyWithLegacyFallback(text);
    }

    if (!didCopy) {
      return false;
    }

    setIsCopied(true);
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_DURATION_MS);
    return true;
  }, []);

  return { copyToClipboard, isCopied };
}
