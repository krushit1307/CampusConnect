import { useState } from "react";
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadTicketPDF } from "./download";
import type { TicketPdfInput } from "./types";

interface DownloadTicketButtonProps {
  /** Same shape consumed by downloadTicketPDF. */
  ticket: TicketPdfInput;
  /** Optional label override. Defaults to \"Download PDF\". */
  label?: string;
  className?: string;
  /** Variant that pairs with the project's neo-brutalist button styles. */
  variant?: "primary" | "ghost";
}

/**
 * <DownloadTicketButton /> — the React surface for issue #1913.
 *
 * Wraps the dynamic-import download helper in a button with loading
 * state and error toasts. Intentionally minimal: callers pass the full
 * TicketPdfInput (already built by the parent route / modal).
 */
export function DownloadTicketButton({
  ticket,
  label = "Download PDF",
  className,
  variant = "primary",
}: DownloadTicketButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadTicketPDF(ticket);
      toast.success("Ticket downloaded");
    } catch (err) {
      console.error("DownloadTicketButton: failed to generate PDF", err);
      toast.error("Couldn't generate the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const baseClass =
    variant === "primary"
      ? "bg-brand-blue-dark text-white hover:bg-brand-blue-muted"
      : "bg-white text-brand-blue-dark border-2 border-black hover:bg-brand-peach-light";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDownloading}
      data-testid="download-ticket-button"
      data-state={isDownloading ? "loading" : "idle"}
      aria-busy={isDownloading}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-2 font-mono text-sm font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-60",
        baseClass,
        className,
      )}
    >
      {isDownloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Preparing…</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
