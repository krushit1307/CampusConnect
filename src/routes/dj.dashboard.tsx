// =============================================================================
// Route: /dj/dashboard
// Issue: #3462 - Build an 'Interactive Live DJ Request System' & #4490 DJ Mode
// Description: Dedicated iPad DJ Booth Dashboard displaying crowd song requests.
// Supports real-time upvotes, swipe-to-dismiss, and Drag-and-Drop admin override.
// =============================================================================

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useLiveDjRequests } from "@/hooks/useLiveDjRequests";

// Icons
import Music from "lucide-react/dist/esm/icons/music";
import Disc from "lucide-react/dist/esm/icons/disc";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";

export default function DJBoothDashboard() {
  const { eventId } = useParams<{ eventId?: string }>();
  const activeEventId = eventId || "default-dance-event";

  // Note: Pass a real Organizer ID here eventually instead of "ORGANIZER_ID"
  const { requests, isLoading, dismissRequest, updateAdminQueueOrder } = useLiveDjRequests(
    activeEventId,
    "ORGANIZER_ID",
  );

  const [swipingId, setSwipingId] = useState<string | null>(null);

  const handleSwipeDismiss = async (requestId: string) => {
    setSwipingId(requestId);
    setTimeout(async () => {
      await dismissRequest(requestId);
      setSwipingId(null);
    }, 250);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const reorderedQueue = Array.from(requests);
    const [movedItem] = reorderedQueue.splice(sourceIndex, 1);
    reorderedQueue.splice(destinationIndex, 0, movedItem);

    void updateAdminQueueOrder(reorderedQueue, movedItem.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans select-none">
      {/* Top iPad DJ Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Disc className="w-8 h-8 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black tracking-tight text-white">DJ Booth Live Queue</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-700">
                LIVE
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              Drag and drop tracks to override the crowd, or click to mark as played.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-xs text-slate-400 font-mono uppercase">Top Crowd Track</div>
            <div className="text-sm font-bold text-indigo-400 truncate max-w-xs">
              {requests[0]
                ? `${requests[0].song_title} (${requests[0].upvotes} votes)`
                : "No requests yet"}
            </div>
          </div>
        </div>
      </div>

      {/* Main DJ Requests Grid / List */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="p-12 text-center font-mono text-slate-400">Loading DJ Queue...</div>
        ) : requests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-400">
            <Sparkles className="w-12 h-12 text-indigo-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-xl font-bold text-white mb-1">DJ Queue is Clean!</h3>
            <p className="text-sm">
              Attendees will submit song requests and upvote crowd favorites live.
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="dj-queue">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-1 gap-4"
                >
                  {requests.map((req, index) => {
                    const isTopTrack = index === 0;
                    const isBeingDismissed = swipingId === req.id;

                    return (
                      <Draggable key={req.id} draggableId={req.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            data-testid={`dj-queue-card-${req.id}`}
                            className={`border rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                              isBeingDismissed
                                ? "translate-x-full opacity-0 scale-95"
                                : snapshot.isDragging
                                  ? "bg-indigo-950 border-indigo-400 shadow-2xl scale-[1.02] z-50"
                                  : isTopTrack && !req.overridden_by_admin
                                    ? "bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/50 border-indigo-500 shadow-xl shadow-indigo-950/50"
                                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                            } ${req.overridden_by_admin ? "border-l-4 border-l-emerald-500" : ""}`}
                          >
                            <div className="flex items-center gap-5">
                              {/* Drag Handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing p-2 text-slate-600 hover:text-slate-300 transition-colors"
                              >
                                <GripVertical className="w-6 h-6" />
                              </div>

                              {/* Rank Badge */}
                              <div
                                className={`w-12 h-12 rounded-2xl font-black text-xl flex items-center justify-center font-mono shrink-0 ${
                                  req.overridden_by_admin
                                    ? "bg-emerald-900 text-emerald-300 border border-emerald-700"
                                    : isTopTrack
                                      ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30"
                                      : index === 1
                                        ? "bg-slate-300 text-slate-950"
                                        : index === 2
                                          ? "bg-amber-700 text-white"
                                          : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                #{index + 1}
                              </div>

                              {/* Album Art */}
                              {req.album_art_url ? (
                                <img
                                  src={req.album_art_url}
                                  alt={req.song_title}
                                  className="w-16 h-16 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                                  <Music className="w-8 h-8" />
                                </div>
                              )}

                              {/* Track Info */}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h2 className="text-xl font-black text-white tracking-tight">
                                    {req.song_title}
                                  </h2>
                                  {req.overridden_by_admin ? (
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black rounded-full uppercase">
                                      DJ Override
                                    </span>
                                  ) : isTopTrack ? (
                                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full uppercase">
                                      #1 Most Requested
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm font-semibold text-slate-400 mt-0.5">
                                  {req.artist}
                                </p>
                              </div>
                            </div>

                            {/* Actions & Upvote Count */}
                            <div className="flex items-center justify-between md:justify-end gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-800">
                              {/* Upvote Pill */}
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 rounded-xl font-mono text-base font-bold shadow-inner">
                                <ThumbsUp className="w-5 h-5 fill-current text-indigo-400" />
                                <span>{req.upvotes} upvotes</span>
                              </div>

                              {/* Swipe / Mark Played Action Button */}
                              <button
                                type="button"
                                onClick={() => handleSwipeDismiss(req.id)}
                                data-testid={`dismiss-btn-${req.id}`}
                                className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 group"
                              >
                                <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span>Played / Dismiss</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
