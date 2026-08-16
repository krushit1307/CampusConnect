import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

interface TranscriptChunk {
  id: string;
  speaker: number | null;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface CaptionsOverlayProps {
  eventId: string;
  enabled: boolean;
}

export function CaptionsOverlay({ eventId, enabled }: CaptionsOverlayProps) {
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) {
      setChunks([]);
      return;
    }

    // Connect to Supabase Realtime for transcript broadcasts
    const channel = supabase.channel(`event-captions:${eventId}`);

    channel
      .on("broadcast", { event: "transcript" }, (payload) => {
        const data = payload.payload;
        if (data && data.channel?.alternatives?.[0]?.transcript) {
          const alt = data.channel.alternatives[0];
          const text = alt.transcript;
          if (text.trim().length === 0) return;

          const isFinal = data.is_final;
          const speaker = alt.words?.[0]?.speaker ?? null;

          setChunks((prev) => {
            const newChunks = [...prev];
            // If the last chunk is not final and from the same speaker, update it
            if (newChunks.length > 0 && !newChunks[newChunks.length - 1].isFinal) {
              newChunks[newChunks.length - 1] = {
                ...newChunks[newChunks.length - 1],
                text,
                isFinal,
                speaker,
                timestamp: Date.now(),
              };
            } else {
              // Otherwise add a new chunk
              newChunks.push({
                id: Math.random().toString(36).substr(2, 9),
                speaker,
                text,
                isFinal,
                timestamp: Date.now(),
              });
            }

            // Keep only the last 5 chunks for the rolling overlay
            if (newChunks.length > 5) {
              return newChunks.slice(newChunks.length - 5);
            }
            return newChunks;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, enabled, supabase]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunks]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute bottom-24 left-0 w-full px-4 sm:px-12 pb-4 flex flex-col justify-end items-center z-50">
      <div className="w-full max-w-3xl flex flex-col gap-2">
        <AnimatePresence>
          {chunks.map((chunk, idx) => {
            // Fade out older chunks based on their index from the end
            const distanceFromEnd = chunks.length - 1 - idx;
            const opacity = Math.max(0.2, 1 - distanceFromEnd * 0.25);

            return (
              <motion.div
                key={chunk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full text-center"
              >
                <span
                  className={`inline-block rounded px-3 py-1 text-lg sm:text-xl font-medium shadow-lg backdrop-blur-md ${
                    chunk.isFinal ? "bg-black/70 text-white" : "bg-black/50 text-gray-200"
                  }`}
                  style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}
                >
                  {chunk.speaker !== null && (
                    <span className="text-yellow-400 mr-2 font-bold">
                      [Speaker {chunk.speaker}]
                    </span>
                  )}
                  {chunk.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
