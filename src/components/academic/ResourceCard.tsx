import React from 'react';
import { Download, Star, Bookmark, Share2, Eye, FileText, CheckCircle, Clock } from 'lucide-react';
import { AcademicResource } from '../../pages/academic/AcademicResourceHubPage';

interface ResourceCardProps {
  resource: AcademicResource;
  onBookmark: () => void;
  onInspect: () => void;
}

export default function ResourceCard({ resource, onBookmark, onInspect }: ResourceCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:shadow-indigo-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Tags & Action */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2.5 py-0.5 rounded-lg font-mono font-semibold">
              {resource.courseCode}
            </span>
            <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs px-2.5 py-0.5 rounded-lg font-semibold">
              {resource.resourceType}
            </span>
            <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-md font-mono">
              {resource.fileFormat} • {resource.fileSize}
            </span>
          </div>

          <button
            onClick={onBookmark}
            className={`p-2 rounded-xl transition ${
              resource.isBookmarked
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
            title="Bookmark Resource"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Title & Description */}
        <h3
          onClick={onInspect}
          className="text-lg font-bold text-slate-100 hover:text-indigo-400 cursor-pointer transition line-clamp-2 mb-2 group-hover:translate-x-0.5"
        >
          {resource.title}
        </h3>
        <p className="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed">
          {resource.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {resource.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="bg-slate-950 text-slate-400 border border-slate-800 text-[11px] px-2 py-0.5 rounded-md">
              #{tag}
            </span>
          ))}
          {resource.tags.length > 3 && (
            <span className="text-slate-500 text-[11px] self-center">+{resource.tags.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Author & Footer Stats */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={resource.author.avatar}
            alt={resource.author.name}
            className="w-8 h-8 rounded-full border border-slate-700 object-cover"
          />
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
              {resource.author.name}
              {resource.author.verified && <CheckCircle className="w-3 h-3 text-emerald-400 inline" />}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {resource.uploadDate}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onInspect}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs transition border border-slate-700"
            title="Quick View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{resource.downloadsCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
