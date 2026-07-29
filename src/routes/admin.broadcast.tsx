import { useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

export default function AdminBroadcast() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error("Title and message are required.");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("broadcast-push-notification", {
        body: { title, message, url },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(`Broadcast sent successfully! Delivered to ${data.sent} devices.`);
      setTitle("");
      setMessage("");
      setUrl("");
    } catch (error: any) {
      console.error("Broadcast failed:", error);
      toast.error(error.message || "Failed to broadcast message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <h1 className="mb-6 text-3xl font-bold">Broadcast Announcement</h1>
        <form onSubmit={handleBroadcast} className="space-y-4 bg-white p-6 neu-border">
          <div>
            <label className="block font-bold mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20"
              placeholder="e.g. Weather Alert"
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20 h-32"
              placeholder="e.g. Campus closed tomorrow due to snow."
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Target URL (optional)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20"
              placeholder="e.g. /events/123"
            />
          </div>
          <button
            type="submit"
            disabled={isSending}
            className="w-full neu-border neu-press bg-black p-3 text-cream font-bold disabled:opacity-50"
          >
            {isSending ? "Broadcasting..." : "Send Broadcast"}
          </button>
        </form>
      </div>
    </SiteShell>
  );
}
