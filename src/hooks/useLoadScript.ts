import { useEffect, useState } from "react";

export function useLoadScript(src: string) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === "true") {
        setLoaded(true);
      } else {
        existing.addEventListener("load", () => setLoaded(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      setLoaded(true);
    };

    script.onerror = () => {
      setError(true);
    };

    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [src]);

  return { loaded, error };
}
