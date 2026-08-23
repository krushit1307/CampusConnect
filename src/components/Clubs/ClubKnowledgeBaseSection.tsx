import React, { useState } from "react";
import { Search, BookOpen, Star, AlertCircle, ThumbsUp, Wrench, Lightbulb } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchClubPostMortems, type EventPostMortem } from "@/services/eventPostMortemService";

export interface ClubKnowledgeBaseSectionProps {
  clubId: string;
}

export const ClubKnowledgeBaseSection: React.FC<ClubKnowledgeBaseSectionProps> = ({ clubId }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: postMortems, isLoading } = useQuery<EventPostMortem[]>({
    queryKey: ["club_post_mortems", clubId, searchQuery],
    queryFn: () => searchClubPostMortems(clubId, searchQuery),
    enabled: !!clubId,
  });

  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000] mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-yellow-300">
            <BookOpen className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className="font-display text-xl font-black uppercase text-black">
              Club Knowledge Base & Retrospectives
            </h3>
            <p className="font-mono text-xs text-black/60">
              Searchable institutional memory and lessons learned from past event organizers.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pizza, audio, venue..."
            className="w-full border-2 border-black py-2 pl-9 pr-3 font-mono text-xs outline-none focus:bg-neutral-50 shadow-[2px_2px_0_0_#000]"
          />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-black/50" />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center font-mono text-xs text-black/50">
          Loading institutional memory...
        </div>
      ) : postMortems && postMortems.length > 0 ? (
        <div className="space-y-4">
          {postMortems.map((retro) => (
            <div
              key={retro.id || retro.event_id}
              className="border-2 border-black bg-neutral-50 p-4 shadow-[2px_2px_0_0_#000]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/20 pb-2 mb-3">
                <div>
                  <h4 className="font-display text-base font-black uppercase text-black">
                    {retro.event_title || "Event Retrospective"}
                  </h4>
                  {retro.created_at && (
                    <span className="font-mono text-[10px] text-black/50">
                      Filed on {new Date(retro.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="border border-black bg-white px-2 py-0.5 font-bold">
                    Logistics: {retro.logistics_score}/5★
                  </span>
                  <span className="border border-black bg-white px-2 py-0.5 font-bold">
                    Budget: {retro.budget_accuracy_score}/5★
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="border border-black bg-emerald-50/70 p-3">
                  <p className="font-black uppercase text-emerald-950 flex items-center gap-1.5 mb-1">
                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-700" /> What Worked
                  </p>
                  <p className="text-black/80">{retro.what_went_well}</p>
                </div>

                <div className="border border-black bg-rose-50/70 p-3">
                  <p className="font-black uppercase text-rose-950 flex items-center gap-1.5 mb-1">
                    <Wrench className="h-3.5 w-3.5 text-rose-700" /> What Failed
                  </p>
                  <p className="text-black/80">{retro.what_failed}</p>
                </div>

                <div className="border border-black bg-amber-50/70 p-3">
                  <p className="font-black uppercase text-amber-950 flex items-center gap-1.5 mb-1">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-700" /> Advice For Next Year
                  </p>
                  <p className="text-black/80 font-bold">{retro.advice_for_next_year}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-black/30 p-8 text-center">
          <p className="font-mono text-xs text-black/50">
            {searchQuery
              ? `No post-mortems matching "${searchQuery}".`
              : "No post-mortems recorded for this club yet."}
          </p>
        </div>
      )}
    </div>
  );
};
