import React, { useState } from 'react';
import { TutorProfile } from '../../../backend/src/models/CampusTutorModel';
import { Star, ShieldCheck, BookOpen, Clock, Calendar, Award, CheckCircle2 } from 'lucide-react';

interface TutorCardProps {
  tutor: TutorProfile;
  onBookClick: (tutor: TutorProfile) => void;
}

export const TutorProfileCard: React.FC<TutorCardProps> = ({ tutor, onBookClick }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between p-6">
      <div>
        {/* Header Badge & Profile */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={tutor.avatarUrl}
              alt={tutor.tutorName}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-50"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-gray-900 text-lg">{tutor.tutorName}</h3>
                {tutor.verifiedStudent && (
                  <ShieldCheck className="w-4 h-4 text-indigo-600 fill-indigo-50" title="Verified Peer Tutor" />
                )}
              </div>
              <p className="text-sm text-gray-500 font-medium">{tutor.department}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-gray-900">${tutor.hourlyRate}</span>
            <span className="text-xs text-gray-500 block">/ hour</span>
          </div>
        </div>

        {/* Course Grade & Rating Pill */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            {tutor.courseCode}: {tutor.courseTitle}
          </span>
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg text-xs">
            <Award className="w-3.5 h-3.5" />
            Grade: {tutor.gradeAchieved}
          </span>
          <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold ml-auto">
            <Star className="w-4 h-4 fill-amber-400" />
            <span>{tutor.rating.toFixed(1)}</span>
            <span className="text-gray-400 font-normal">({tutor.totalSessions} sessions)</span>
          </div>
        </div>

        {/* Bio */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{tutor.bio}</p>

        {/* Subjects Badges */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {tutor.subjects.map((sub, idx) => (
            <span
              key={idx}
              className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-medium"
            >
              {sub}
            </span>
          ))}
        </div>

        {/* Next Availability */}
        <div className="bg-gray-50 rounded-xl p-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-gray-600 font-medium mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Next Available Slot:</span>
          </div>
          <span className="text-xs text-gray-800 font-semibold block">
            {tutor.availability[0] || "Flexible Schedule"}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onBookClick(tutor)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Book Peer Session
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Tutor Profile"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <BookOpen className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
