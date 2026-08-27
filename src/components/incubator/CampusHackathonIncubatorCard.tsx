import React from 'react';
import { Rocket, DollarSign, Award, Users } from 'lucide-react';

interface CardProps {
  project: {
    _id: string;
    projectName: string;
    campusName: string;
    leadStudentName: string;
    teamSize: number;
    projectDomain: string;
    prizeFundingUsd: number;
    incubatorGrantUsd: number;
    prototypeStatus: string;
  };
  onGrantClick: (projectId: string) => void;
}

export const CampusHackathonIncubatorCard: React.FC<CardProps> = ({ project, onGrantClick }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5 text-purple-400" />
            {project.projectDomain}
          </span>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              project.prototypeStatus === 'INCUBATED_STARTUP'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
            }`}
          >
            {project.prototypeStatus}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">{project.projectName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lead: {project.leadStudentName} • {project.teamSize} Member Team ({project.campusName})
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-purple-400 block tracking-tight">
              ${project.incubatorGrantUsd.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Prize Won: ${project.prizeFundingUsd.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-slate-950/40 rounded-2xl p-3.5 mb-5 space-y-2 text-xs border border-slate-800/40">
          <div className="flex justify-between">
            <span className="text-slate-400">Student Team Size:</span>
            <span className="font-bold text-white flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              {project.teamSize} Developers & Founders
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onGrantClick(project._id)}
        className="w-full font-extrabold text-xs py-3 px-4 rounded-2xl shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-slate-950 shadow-purple-500/20 transition-all flex items-center justify-center gap-1.5"
      >
        <DollarSign className="w-4 h-4" />
        Inject Venture Incubator Capital
      </button>
    </div>
  );
};
