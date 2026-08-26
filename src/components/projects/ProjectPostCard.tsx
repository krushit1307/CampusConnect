import React, { useState } from 'react';
import { ProjectPost } from '../../../backend/src/models/CampusProjectModel';
import { Users, Code, Sparkles, Clock, CheckCircle2, UserPlus, Send, Rocket } from 'lucide-react';

interface ProjectCardProps {
  project: ProjectPost;
  onApplyClick: (project: ProjectPost) => void;
}

export const ProjectPostCard: React.FC<ProjectCardProps> = ({ project, onApplyClick }) => {
  const [copied, setCopied] = useState(false);

  const getProjectTypeBadge = (type: string) => {
    switch (type) {
      case 'capstone':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'hackathon':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'research':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between">
      <div>
        {/* Header Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs">
              {project.courseCode}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getProjectTypeBadge(project.projectType)}`}>
              {project.projectType}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold bg-gray-50 px-2.5 py-1 rounded-lg">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Team of {project.teamSize}</span>
          </div>
        </div>

        {/* Project Title & Owner */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{project.title}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          Lead: <span className="text-gray-800 font-semibold">{project.ownerName}</span> ({project.ownerRole})
        </p>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-4 line-clamp-3 leading-relaxed">{project.description}</p>

        {/* Open Roles Pill List */}
        <div className="mb-4">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Looking for Collaborators:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {project.openRoles.map((role, idx) => (
              <span
                key={idx}
                className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" /> {role}
              </span>
            ))}
          </div>
        </div>

        {/* Required Skills Tech Stack */}
        <div className="mb-5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Tech Stack / Skills:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {project.requiredSkills.map((skill, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Owner Info & Actions */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img
              src={project.ownerAvatar}
              alt={project.ownerName}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-50"
            />
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-300" /> {project.postedDate}
            </span>
          </div>
          <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
            {project.department}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onApplyClick(project)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Apply as Collaborator
          </button>
          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            title="Share Project"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Rocket className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
