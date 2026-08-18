import React from 'react';
import { NoteBookmark } from '../../../backend/src/models/CampusNoteModel';
import { Bookmark, Clock, BookOpen, Trash2, ArrowRight } from 'lucide-react';

interface ActivityTimelineProps {
  bookmarks: NoteBookmark[];
  onRemoveBookmark: (noteId: string) => void;
}

export const NoteActivityTimeline: React.FC<ActivityTimelineProps> = ({
  bookmarks,
  onRemoveBookmark,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">My Saved Study Guides & Notes</h3>
          <p className="text-sm text-gray-500">Quick access to bookmarked course notes and exam review sheets</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {bookmarks.length} Bookmarked
        </span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Bookmark className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No notes bookmarked yet</p>
          <p className="text-xs text-gray-400 mt-1">Click the bookmark icon on any course note card to save it here for offline study.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bm) => (
            <div
              key={bm.id}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                      {bm.courseCode}
                    </span>
                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{bm.noteTitle}</h4>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-300" /> Saved {bm.savedDate}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRemoveBookmark(bm.noteId)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove Bookmark"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
