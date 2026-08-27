// =============================================================================
// Component: MentorProfileCard
// Issue: #2963 - Build an 'Alumni Mentorship' Matching Module
// Description: Renders an individual alumni mentor's profile in the directory 
// grid. Shows their capacity status, expertise tags, and a CTA to request 
// mentorship.
// =============================================================================

import React from 'react';
import { MentorProfile } from '../../hooks/useMentorshipDirectory';

interface MentorProfileCardProps {
  mentor: MentorProfile;
  onRequest: () => void;
}

export const MentorProfileCard: React.FC<MentorProfileCardProps> = ({ mentor, onRequest }) => {
  const isFull = !mentor.is_accepting || mentor.current_mentees >= mentor.max_mentees;
  const capacityPct = (mentor.current_mentees / mentor.max_mentees) * 100;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col">
      <div className="flex items-start gap-4 mb-4">
        {mentor.profiles?.avatar_url ? (
          <img 
            src={mentor.profiles.avatar_url} 
            alt={mentor.profiles.full_name}
            className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xl flex-shrink-0">
            {mentor.profiles?.full_name?.charAt(0) || 'A'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white truncate">
            {mentor.profiles?.full_name || 'Alumni'}
          </h3>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">
            {mentor.job_title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {mentor.company} • {mentor.industry}
          </p>
        </div>
      </div>

      {mentor.bio && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 flex-1">
          {mentor.bio}
        </p>
      )}

      {/* Expertise Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {mentor.expertise_tags.slice(0, 4).map(tag => (
          <span 
            key={tag}
            className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
          >
            {tag}
          </span>
        ))}
        {mentor.expertise_tags.length > 4 && (
          <span className="px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            +{mentor.expertise_tags.length - 4} more
          </span>
        )}
      </div>

      {/* Capacity Indicator */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          <span>Mentorship Capacity</span>
          <span>{mentor.current_mentees}/{mentor.max_mentees}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all ${
              isFull ? 'bg-red-500' : capacityPct > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, capacityPct)}%` }}
          ></div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onRequest}
        disabled={isFull}
        className={`w-full py-2 rounded-lg font-medium text-sm transition-all ${
          isFull 
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm'
        }`}
      >
        {isFull ? 'Currently Full' : 'Request Mentorship'}
      </button>
    </div>
  );
};
