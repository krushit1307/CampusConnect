import { useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Compass from "lucide-react/dist/esm/icons/compass";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import { TagSubscribeButton } from "@/components/discovery/TagSubscribeButton";

// MOCK DATA: We will replace this with the real backend API later
const MOCK_TRENDING_TAGS = [
  { id: "1", name: "Blockchain", velocity: "+400%" },
  { id: "2", name: "Hackathon", velocity: "+250%" },
  { id: "3", name: "AI", velocity: "+180%" },
  { id: "4", name: "OpenSource", velocity: "+120%" },
  { id: "5", name: "Web3", velocity: "+90%" },
];

export default function ExploreShowcase() {
  const supabase = createClient();
  const [showRsvpModal, setShowRsvpModal] = useState(false);

  // NEW: State to track the currently selected trending tag
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    // NEW: Add selectedTag to the queryKey so it refetches when the tag changes
    queryKey: ["public_showcase_events", selectedTag],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select(
          `
          id,
          title,
          description,
          start_time,
          location,
          clubs (name)
        `,
        )
        .eq("is_public_showcase", true)
        .order("start_time", { ascending: true });

      // NEW: Filter the Supabase query if a tag is clicked
      if (selectedTag) {
        // NOTE: You may need to adjust 'standard_tag_id' based on the actual DB schema!
        query = query.eq("standard_tag_id", selectedTag);
      }

      const { data, error } = await query;
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
                Experience vibrant student life! These high-profile student events are currently
                open for public viewing on campus.
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

          {/* NEW: Neo-Brutalist Trending Tags Component */}
          <div className="neu-border bg-[#fef08a] p-4 shadow-[4px_4px_0_0_#000]">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-display text-lg font-black uppercase tracking-tight">
                Trending This Week
              </h3>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="ml-auto font-mono text-xs font-bold underline hover:text-red-600"
                >
                  Clear Filter
                </button>
              )}
            </div>
            {selectedTag && (
              <div className="mb-3">
                <TagSubscribeButton
                  tagName={
                    MOCK_TRENDING_TAGS.find((tag) => tag.id === selectedTag)?.name || selectedTag
                  }
                />
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {MOCK_TRENDING_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                  className={`group relative flex items-center gap-2 border-2 border-black px-4 py-2 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000] ${
                    selectedTag === tag.id ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  <span>#{tag.name}</span>
                  <span
                    className={`text-[10px] ${selectedTag === tag.id ? "text-green-400" : "text-green-600"}`}
                  >
                    {tag.velocity}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Event Grid */}
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
              <p className="font-mono text-sm text-black/55 font-bold uppercase">
                No events found for this tag.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Guest RSVP Admission Dialog */}
      <Dialog open={showRsvpModal} onOpenChange={setShowRsvpModal}>
        <DialogContent className="sm:max-w-md neu-border shadow-[8px_8px_0_0_#000] rounded-none border-4 border-black">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-black uppercase tracking-tight">
              Student Account Required 🔒
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-black">
            <p className="text-sm font-mono font-bold leading-relaxed">
              You must be an enrolled student to RSVP. Apply to the University today to get full
              access to student organizations, custom schedules, and exclusive campus events!
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <a
                href="https://admissions.university.edu"
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border border-2 border-black bg-[#a3e635] text-black text-center py-2.5 font-mono text-xs font-bold uppercase hover:bg-lime-400 transition-colors shadow-[2px_2px_0_0_#000]"
              >
                Apply to the University Today
              </a>
              <Button
                variant="outline"
                onClick={() => setShowRsvpModal(false)}
                className="font-mono text-xs uppercase border-2 border-black rounded-none hover:bg-gray-100"
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
