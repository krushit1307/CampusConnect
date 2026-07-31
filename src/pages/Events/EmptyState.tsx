import React from "react";
import { Calendar } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] p-8 text-center text-neutral-500">
      <div className="bg-white neu-border p-6 rounded-xl flex flex-col items-center">
        <Calendar className="w-16 h-16 mb-4 text-black opacity-20" />
        <h2 className="text-2xl font-bold font-display text-black mb-2">Select an event</h2>
        <p className="text-sm font-mono max-w-sm">
          Click on any event from the list on the left to view its details, RSVP, or see who is
          attending.
        </p>
      </div>
    </div>
  );
}
