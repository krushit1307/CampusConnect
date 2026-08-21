import { useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Compass from "lucide-react/dist/esm/icons/compass";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";

export default function ExploreShowcase() {
  const supabase = createClient();
  const [showRsvpModal, setShowRsvpModal] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["public_showcase_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          start_time,
          location,
          clubs (name)
        `)
        .eq("is_public_showcase", true)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-12 md:px-6 lg:px-8 text-black">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Showcase Banner */}
          <div className="neu-border bg-[#dbeafe] p-8 shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-blue-900">
                <Compass className="h-4 w-4 animate-spin-slow" /> Interactive Campus Tour
              </p>
              <h1 className="font-display text-4xl font-black text-black md:text-5xl uppercase">
                Public Event Showcase
              </h1>
              <p className="max-w-xl font-mono text-sm text-black/70">
                Experience vibrant student life! These high-profile student events are currently open for public viewing on campus.
              </p>
            </div>
            <a
              href="https://admissions.university.edu"
              target="_blank"
              rel="noopener noreferrer"
              className="neu-border bg-[#a3e635] text-black px-6 py-3 font-mono text-sm font-bold uppercase hover:-translate-y-0.5 transition-transform flex items-center gap-2 self-start md:self-auto shadow-[2px_2px_0_0_#000]"
            >
              <GraduationCap className="h-5 w-5" /> Apply Today
            </a>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map((event: any) => (
                <div
                  key={event.id}
                  className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-800 border-none font-mono text-[10px] font-bold uppercase">
                        Public Showcase
                      </Badge>
                      <span className="font-mono text-xs font-bold text-gray-500">
                        {event.clubs?.name}
                      </span>
                    </div>
                    <h2 className="font-display text-xl font-black uppercase tracking-tight">
                      {event.title}
                    </h2>
                    <p className="font-mono text-xs text-black/60 line-clamp-3">
                      {event.description || "No description provided."}
                    </p>
                    <div className="space-y-1.5 pt-2 font-mono text-xs text-black/70">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <span>{new Date(event.start_time).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-gray-400" />
                        <span>{event.location || "On Campus"}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowRsvpModal(true)}
                    className="neu-border bg-black text-white hover:bg-gray-900 w-full mt-6 py-2.5 font-mono text-xs font-bold uppercase rounded-none shadow-[2px_2px_0_0_#000]"
                  >
                    RSVP to Event
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="neu-border bg-white p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-mono text-sm text-black/55 italic">
                No public showcase events active right now. Check back during tours!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Guest RSVP Admission Dialog */}
      <Dialog open={showRsvpModal} onOpenChange={setShowRsvpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-black uppercase tracking-tight">
              Student Account Required 🔒
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-black dark:text-white">
            <p className="text-sm font-mono text-gray-600 dark:text-gray-400 leading-relaxed">
              You must be an enrolled student to RSVP. Apply to the University today to get full access to student organizations, custom schedules, and exclusive campus events!
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="https://admissions.university.edu"
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border bg-[#a3e635] text-black text-center py-2.5 font-mono text-xs font-bold uppercase hover:bg-lime-400 transition-colors"
              >
                Apply to the University Today
              </a>
              <Button
                variant="ghost"
                onClick={() => setShowRsvpModal(false)}
                className="font-mono text-xs uppercase"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
