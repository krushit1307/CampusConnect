import React, { useState } from 'react';
import { CourseNote } from '../../../backend/src/models/CampusNoteModel';
import { BookOpen, ThumbsUp, Download, Bookmark, FileText, CheckCircle2, ShieldCheck, Share2, Layers } from 'lucide-react';

interface NoteCardProps {
  note: CourseNote;
  isBookmarked: boolean;
  onUpvoteClick: (id: string) => void;
  onBookmarkClick: (id: string) => void;
}

export const CourseNoteCard: React.FC<NoteCardProps> = ({
  note,
  isBookmarked,
  onUpvoteClick,
  onBookmarkClick,
}) => {
  const [upvotes, setUpvotes] = useState<number>(note.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleUpvote = () => {
    if (!hasUpvoted) {
      setUpvotes((prev) => prev + 1);
      setHasUpvoted(true);
      onUpvoteClick(note.id);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatBadge = (fmt: string) => {
    switch (fmt) {
      case 'pdf':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'goodnotes':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'docx':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between">
      <div>
        {/* Course Header & Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs">
              {note.courseCode}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getFormatBadge(note.fileFormat)}`}>
              {note.fileFormat}
            </span>
            {note.isVerified && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Peer Verified
              </span>
            )}
          </div>
          <button
            onClick={() => onBookmarkClick(note.id)}
            className={`p-2 rounded-xl transition-colors ${
              isBookmarked ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400 hover:text-gray-600'
            }`}
            title="Bookmark Note"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500' : ''}`} />
          </button>
        </div>

        {/* Note Title */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{note.title}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          {note.courseTitle} • By <span className="text-gray-800 font-semibold">{note.authorName}</span>
        </p>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-4 line-clamp-3 leading-relaxed">{note.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {note.tags.map((tag, idx) => (
            <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>

        {/* Meta Stats Bar */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 flex items-center justify-between text-xs text-gray-600">
          <span className="flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-indigo-600" /> {note.pageCount} Pages ({note.fileSize})
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Download className="w-3.5 h-3.5 text-emerald-600" /> {note.downloads} Downloads
          </span>
        </div>
      </div>

      {/* Footer Author & Actions */}
      <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={note.authorAvatar}
            alt={note.authorName}
            className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-50"
          />
          <span className="text-xs text-gray-400 font-medium">{note.postedDate}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpvote}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              hasUpvoted
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-indigo-600' : ''}`} />
            <span>{upvotes}</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            title="Share Note Link"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
