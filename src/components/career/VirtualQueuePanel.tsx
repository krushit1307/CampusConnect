import React from 'react';
import { EmployerBooth } from '@/types/careerFair';
import { Users, Clock, CheckCircle2, ChevronRight, XCircle, Sparkles, Building } from 'lucide-react';

interface VirtualQueuePanelProps {
  selectedBooth: EmployerBooth | null;
  activeQueues: string[]; // Booth IDs student has joined
  onJoinQueue: (boothId: string) => void;
  onLeaveQueue: (boothId: string) => void;
}

export function VirtualQueuePanel({
  selectedBooth,
  activeQueues,
  onJoinQueue,
  onLeaveQueue,
}: VirtualQueuePanelProps) {
  if (!selectedBooth) {
    return (
      <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center flex flex-col items-center justify-center h-full min-h-[300px]">
        <Building size={36} className="text-gray-300 mb-2" />
        <p className="font-display font-black text-lg text-black">Select a Booth on the Map</p>
        <p className="font-mono text-xs text-gray-500 max-w-xs mt-1">
          Click any company booth to inspect role requirements, tech stack, and join their virtual queue.
        </p>
      </div>
    );
  }

  const isQueued = activeQueues.includes(selectedBooth.id);

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between h-full space-y-4">
      <div>
        {/* Header with Match Badge */}
        <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-xl text-black">
                {selectedBooth.name}
              </h3>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 border border-black rounded">
                Booth #{selectedBooth.boothNumber}
              </span>
            </div>
            <p className="font-mono text-xs text-gray-600">{selectedBooth.industry}</p>
          </div>

          {selectedBooth.matchScore && (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-lime border-2 border-black rounded font-mono text-xs font-black shadow-xs">
                <Sparkles size={12} /> {selectedBooth.matchScore}% Match
              </span>
            </div>
          )}
        </div>

        {/* Match Reason */}
        {selectedBooth.matchReason && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded font-mono text-xs text-emerald-900">
            <span className="font-bold">AI Match Reason: </span>
            {selectedBooth.matchReason}
          </div>
        )}

        {/* Roles & Tech Stack */}
        <div className="mt-4 space-y-3">
          <div>
            <h4 className="font-mono text-xs font-bold uppercase text-gray-500 mb-1.5">
              Open Positions
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedBooth.hiringRoles.map((role) => (
                <span
                  key={role}
                  className="px-2.5 py-1 bg-slate-100 border border-black rounded-full font-mono text-xs font-bold"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-xs font-bold uppercase text-gray-500 mb-1.5">
              Preferred Tech Stack
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedBooth.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] text-gray-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Action Section */}
      <div className="pt-4 border-t-2 border-black">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2.5 bg-slate-50 border border-black rounded flex items-center gap-2">
            <Users size={16} className="text-gray-500" />
            <div>
              <div className="font-mono text-[10px] text-gray-500">Students Waiting</div>
              <div className="font-display font-black text-sm">{selectedBooth.virtualQueueLength}</div>
            </div>
          </div>
          <div className="p-2.5 bg-slate-50 border border-black rounded flex items-center gap-2">
            <Clock size={16} className="text-gray-500" />
            <div>
              <div className="font-mono text-[10px] text-gray-500">Est. Wait</div>
              <div className="font-display font-black text-sm">{selectedBooth.estimatedWaitMinutes} mins</div>
            </div>
          </div>
        </div>

        {isQueued ? (
          <button
            onClick={() => onLeaveQueue(selectedBooth.id)}
            className="w-full py-3 bg-red-100 hover:bg-red-200 text-red-800 border-2 border-black rounded font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-colors"
          >
            <XCircle size={16} /> Leave Virtual Queue (Position #3)
          </button>
        ) : (
          <button
            onClick={() => onJoinQueue(selectedBooth.id)}
            className="w-full py-3 bg-lime hover:bg-lime/90 text-black border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 transition-transform active:scale-95"
          >
            <CheckCircle2 size={16} /> Join Virtual Queue
          </button>
        )}
      </div>
    </div>
  );
}
