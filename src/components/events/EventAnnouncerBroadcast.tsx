import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";

export function EventAnnouncerBroadcast({ eventId }: { eventId: string }) {
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"high" | "urgent">("high");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const supabase = createClient();

  const handleBroadcast = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message to broadcast.");
      return;
    }

    setIsBroadcasting(true);
    try {
      const { error } = await supabase.from("event_announcements").insert({
        event_id: eventId,
        message: message.trim(),
        priority,
      });

      if (error) throw error;

      toast.success("Announcement broadcasted successfully!");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to broadcast announcement");
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={20} className="text-blue-600" />
        <h2 className="font-display text-xl font-black uppercase">Live Announcer</h2>
      </div>

      <p className="font-mono text-sm text-gray-600 mb-4">
        Broadcast an urgent message to all attendees currently viewing the app.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block font-mono text-xs font-bold uppercase mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full neu-border bg-gray-50 p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black min-h-[80px]"
            placeholder="e.g., Pizza has arrived in the lobby! 🍕"
            maxLength={200}
          />
          <div className="text-right font-mono text-xs text-gray-500 mt-1">
            {message.length}/200
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="high"
                checked={priority === "high"}
                onChange={() => setPriority("high")}
                className="w-4 h-4 text-black border-2 border-black focus:ring-black"
              />
              <span className="font-mono text-sm font-bold">Standard Alert</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="urgent"
                checked={priority === "urgent"}
                onChange={() => setPriority("urgent")}
                className="w-4 h-4 text-black border-2 border-black focus:ring-black"
              />
              <span className="font-mono text-sm font-bold text-red-600">Urgent</span>
            </label>
          </div>

          <button
            onClick={handleBroadcast}
            disabled={isBroadcasting || !message.trim()}
            className="neu-border neu-press inline-flex items-center gap-2 bg-blue-300 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBroadcasting ? (
              <span className="animate-pulse">Broadcasting...</span>
            ) : (
              <>
                Broadcast <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
