import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export interface TicketEventData {
  id: string;
  title: string;
  event_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
}

interface ProfileData {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * useTicketDownload
 *
 * Shared hook that handles the full ticket-download flow:
 *  1. Fetches the caller's profile to get their display name.
 *  2. Calls the `generate-ticket-jwt` Edge Function to get a signed JWT.
 *  3. Spawns a ticket-pdf.worker (off main thread) to build the PDF.
 *  4. Triggers a Blob-URL download of the resulting PDF.
 *
 * Usage:
 *   const { downloadTicket, isGenerating } = useTicketDownload();
 *   <Button onClick={() => downloadTicket(event)} disabled={isGenerating}>
 *     Download Ticket
 *   </Button>
 */
export function useTicketDownload() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingEventId, setGeneratingEventId] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const downloadTicket = useCallback(async (event: TicketEventData) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGeneratingEventId(event.id);

    const toastId = toast.loading("Generating your ticket…");

    try {
      const supabase = createClient();

      // ── 1. Get session (needed for the Edge Function auth header) ──
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please log in to download your ticket.", { id: toastId });
        setIsGenerating(false);
        return;
      }

      // ── 2. Fetch the attendee's display name from their profile ──
      let attendeeName = "Guest";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("id", session.user.id)
          .single<ProfileData>();

        if (profile) {
          if (profile.full_name) {
            attendeeName = profile.full_name;
          } else if (profile.first_name || profile.last_name) {
            attendeeName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
          }
        }
      } catch {
        // Non-fatal — fall back to "Guest"
      }

      // ── 3. Request a signed JWT from the Edge Function ──
      const { data: jwtData, error: fnError } = await supabase.functions.invoke(
        "generate-ticket-jwt",
        {
          body: { eventId: event.id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (fnError || !jwtData?.token) {
        throw new Error(fnError?.message ?? "Failed to generate ticket token.");
      }

      // ── 4. Spawn (or reuse) the PDF worker and generate the PDF ──
      const pdfBytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
        // Terminate any previous worker
        workerRef.current?.terminate();

        const worker = new Worker(
          new URL("../workers/ticket-pdf.worker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;

        worker.onmessage = (
          e: MessageEvent<{ success: boolean; pdfBytes?: Uint8Array<ArrayBuffer>; error?: string }>,
        ) => {
          worker.terminate();
          workerRef.current = null;
          if (e.data.success && e.data.pdfBytes) {
            resolve(e.data.pdfBytes);
          } else {
            reject(new Error(e.data.error ?? "Worker returned an error"));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(err.message ?? "Worker crashed"));
        };

        worker.postMessage({
          token: jwtData.token,
          eventTitle: event.title,
          eventDate: event.start_date ?? event.event_date ?? new Date().toISOString(),
          eventEndDate: event.end_date ?? undefined,
          eventLocation: event.location ?? "To Be Announced",
          attendeeName,
          rsvpId: jwtData.token.split(".")[1]
            ? (() => {
                try {
                  // Extract rsvp id from JWT payload for the stub footer
                  const payload = JSON.parse(atob(jwtData.token.split(".")[1]));
                  return payload.ticket_id as string;
                } catch {
                  return "unknown";
                }
              })()
            : "unknown",
        });
      });

      // ── 5. Trigger browser download ──
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      link.href = url;
      link.setAttribute("download", `${safeTitle}-ticket.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke after a short delay to ensure the download starts
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast.success("🎟 Ticket downloaded!", { id: toastId });
    } catch (err) {
      console.error("Ticket download error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to generate ticket. Please try again.",
        { id: toastId },
      );
    } finally {
      setIsGenerating(false);
      setGeneratingEventId(null);
    }
  }, [isGenerating]);

  return { downloadTicket, isGenerating, generatingEventId };
}
