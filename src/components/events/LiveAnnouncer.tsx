import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, X, BellRing } from "lucide-react";

interface Announcement {
  id: string;
  event_id: string;
  message: string;
  priority: string;
  created_at: string;
}

export function LiveAnnouncer() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Listen for new inserts into event_announcements
    const channel = supabase
      .channel("public:event_announcements")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_announcements",
        },
        (payload) => {
          const newAnnouncement = payload.new as Announcement;
          setAnnouncements((prev) => [newAnnouncement, ...prev]);

          // Automatically clear this announcement after 5 minutes (300000 ms)
          setTimeout(() => {
            setAnnouncements((prev) => prev.filter((a) => a.id !== newAnnouncement.id));
          }, 300000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (announcements.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-2 p-2 sm:p-4 pointer-events-none">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className="animate-in slide-in-from-top-full duration-500 fade-in zoom-in-95 pointer-events-auto"
        >
          <div
            className={`mx-auto max-w-3xl flex items-start sm:items-center gap-3 border-2 border-black p-3 sm:p-4 shadow-[4px_4px_0_0_#000] ${
              announcement.priority === "high" || announcement.priority === "urgent"
                ? "bg-red-400 text-black"
                : "bg-yellow-300 text-black"
            }`}
          >
            <div className="shrink-0 mt-0.5 sm:mt-0">
              {announcement.priority === "urgent" || announcement.priority === "high" ? (
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <BellRing className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </div>

            <div className="flex-1 font-mono text-sm sm:text-base font-bold">
              {announcement.message}
            </div>

            <button
              onClick={() => {
                setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id));
              }}
              className="shrink-0 border-2 border-transparent p-1 hover:border-black transition-colors bg-white/20 hover:bg-white/40"
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
