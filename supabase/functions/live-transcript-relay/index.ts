import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const userId = url.searchParams.get("userId"); // Who initiated it

  if (!eventId) {
    return new Response("Missing eventId", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY");

  if (!deepgramApiKey) {
    console.error("Missing DEEPGRAM_API_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Accumulate the full transcript to save later
  let fullTranscript = "";
  let deepgramSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    // Connect to Deepgram
    deepgramSocket = new WebSocket(
      "wss://api.deepgram.com/v1/listen?diarize=true&punctuate=true&model=nova-2",
      ["token", deepgramApiKey],
    );

    deepgramSocket.onopen = () => {
      console.log(`[live-transcript-relay] Deepgram connected for event ${eventId}`);
    };

    deepgramSocket.onmessage = (event) => {
      // Send the JSON back to the client to render in the UI and broadcast to other peers
      clientSocket.send(event.data);

      try {
        const data = JSON.parse(event.data);
        if (data.is_final && data.channel?.alternatives?.[0]?.transcript) {
          const alt = data.channel.alternatives[0];
          if (alt.transcript.trim().length > 0) {
            // Simple string building for the final saved transcript
            const speaker =
              alt.words?.[0]?.speaker !== undefined ? `[Speaker ${alt.words[0].speaker}]` : "";
            fullTranscript += `${speaker} ${alt.transcript}\n`;
          }
        }
      } catch (e) {
        // ignore parsing errors for saving
      }
    };

    deepgramSocket.onclose = () => {
      console.log(`[live-transcript-relay] Deepgram closed for event ${eventId}`);
      clientSocket.close();
    };

    deepgramSocket.onerror = (e) => {
      console.error(`[live-transcript-relay] Deepgram error:`, e);
    };
  };

  clientSocket.onmessage = (event) => {
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(event.data);
    }
  };

  clientSocket.onclose = async () => {
    console.log(`[live-transcript-relay] Client closed for event ${eventId}`);
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      // Send close stream message to Deepgram
      deepgramSocket.send(JSON.stringify({ type: "CloseStream" }));
      deepgramSocket.close();
    }

    // Save transcript to event_resources
    if (fullTranscript.trim().length > 0) {
      try {
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Generate a filename
        const filename = `${eventId}/transcript-${Date.now()}.txt`;
        const fileContent = new TextEncoder().encode(fullTranscript);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("event-resources")
          .upload(filename, fileContent, {
            contentType: "text/plain",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[live-transcript-relay] Failed to upload transcript:`, uploadError);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("event-resources")
          .getPublicUrl(filename);

        const transcriptUrl = publicUrlData.publicUrl;

        // Insert into event_resources
        const { error: insertError } = await supabase.from("event_resources").insert({
          event_id: eventId,
          title: "Live Transcript",
          url: transcriptUrl,
          resource_type: "transcript",
          is_private: false, // public for attendees
          uploaded_by: userId || "00000000-0000-0000-0000-000000000000", // Fallback if missing
        });

        if (insertError) {
          console.error(`[live-transcript-relay] Failed to insert resource record:`, insertError);
        } else {
          console.log(`[live-transcript-relay] Successfully saved transcript for event ${eventId}`);
        }
      } catch (err) {
        console.error(`[live-transcript-relay] Archival error:`, err);
      }
    }
  };

  clientSocket.onerror = (e) => {
    console.error(`[live-transcript-relay] Client socket error:`, e);
  };

  return response;
}

if (import.meta.main) {
  serve(handler);
}
