export interface WebShareData {
  title: string;
  text: string;
  url: string;
}

export type ShareResult =
  | { kind: "success" }
  | { kind: "abort" }
  | { kind: "unavailable" }
  | { kind: "error"; error: Error };

interface WebShareResult {
  canShare: boolean;
  share: (data: WebShareData) => Promise<ShareResult>;
  copyToClipboard: (text: string) => Promise<boolean>;
  copied: boolean;
}

export function useWebShare(): WebShareResult {
  const [copied, setCopied] = useState(false);

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const share = useCallback(
    async (data: WebShareData): Promise<ShareResult> => {
      if (!canShare) return { kind: "unavailable" };

      try {
        if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
          return { kind: "unavailable" };
        }
        await navigator.share(data);
        return { kind: "success" };
      } catch (err) {
        const error = err as Error;
        if (error.name === "AbortError") {
          return { kind: "abort" };
        }
        return { kind: "error", error };
      }
    },
    [canShare],
  );

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { canShare, share, copyToClipboard, copied };
}
