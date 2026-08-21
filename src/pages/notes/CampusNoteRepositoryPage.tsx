import React, { useState } from 'react';
import {
  CampusNoteServiceHandler,
} from '../../backend/src/services/CampusNoteService';
import {
  CourseNote,
  NoteBookmark,
  NoteFilterOptions,
} from '../../backend/src/models/CampusNoteModel';
import { CourseNoteCard } from '../../src/components/notes/CourseNoteCard';
import { NoteActivityTimeline } from '../../src/components/notes/NoteActivityTimeline';
import {
  BookOpen,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  FileText,
  Upload,
} from 'lucide-react';

export const CampusNoteRepositoryPage: React.FC = () => {
  const [notes, setNotes] = useState<CourseNote[]>(() =>
    CampusNoteServiceHandler.fetchNoteListings()
  );
  const [bookmarks, setBookmarks] = useState<NoteBookmark[]>(() =>
    CampusNoteServiceHandler.fetchUserBookmarks()
  );

  const [filters, setFilters] = useState<NoteFilterOptions>({
    department: 'All',
    fileFormat: 'All',
    verifiedOnly: false,
    searchQuery: '',
  });

  // Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCourseCode, setNewCourseCode] = useState<string>('');
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('Computer Science');
  const [newFormat, setNewFormat] = useState<'pdf' | 'docx' | 'markdown' | 'goodnotes'>('pdf');
  const [newPageCount, setNewPageCount] = useState<number>(12);
  const [newDescription, setNewDescription] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('Algorithms, Final Review');

  const applyFilterChanges = (updatedFilters: Partial<NoteFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setNotes(CampusNoteServiceHandler.fetchNoteListings(nextFilters));
  };

  const handleUpvote = (id: string) => {
    CampusNoteServiceHandler.upvoteCourseNote(id);
  };

  const handleBookmarkToggle = (noteId: string) => {
    CampusNoteServiceHandler.toggleSavedNoteBookmark(noteId);
    setBookmarks(CampusNoteServiceHandler.fetchUserBookmarks());
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    CampusNoteServiceHandler.uploadNewCourseNote({
      title: newTitle,
      courseCode: newCourseCode,
      courseTitle: newCourseTitle,
      department: newDepartment,
      authorName: "Alex Mercer",
      authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      fileFormat: newFormat,
      fileSize: "3.8 MB",
      pageCount: newPageCount,
      tags: newTags.split(',').map((t) => t.trim()),
      description: newDescription,
    });

    setNotes(CampusNoteServiceHandler.fetchNoteListings(filters));
    setShowUploadModal(false);
    setNewTitle('');
    setNewCourseCode('');
    setNewCourseTitle('');
    setNewDescription('');
  };

  const isNoteBookmarked = (id: string) => bookmarks.some((b) => b.noteId === id);

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              Verified Open-Source Student Knowledge Base
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Campus Note Sharing & Exam Study Guide Repository
            </h1>
            <p className="text-emerald-200 text-base sm:text-lg leading-relaxed">
              Access high-scoring lecture notes, midterm review sheets, iPad GoodNotes notebooks, and practice exam solutions shared by top students in your major.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-50 transition-all flex items-center gap-2 text-sm"
              >
                <Upload className="w-5 h-5 text-emerald-600" />
                Upload Course Notes
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by note title, course code (e.g. CS 301), topic, or tag..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm text-gray-900"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.department}
                onChange={(e) => applyFilterChanges({ department: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
              </select>

              {/* Format Dropdown */}
              <select
                value={filters.fileFormat}
                onChange={(e) => applyFilterChanges({ fileFormat: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Formats</option>
                <option value="pdf">PDF Document</option>
                <option value="goodnotes">GoodNotes Notebook</option>
                <option value="docx">Word DOCX</option>
              </select>
            </div>
          </div>
        </div>

        {/* Note Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-600" />
              Course Study Guides & Notes ({notes.length})
            </h2>
          </div>

          {notes.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No notes found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or department filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {notes.map((n) => (
                <CourseNoteCard
                  key={n.id}
                  note={n}
                  isBookmarked={isNoteBookmarked(n.id)}
                  onUpvoteClick={handleUpvote}
                  onBookmarkClick={handleBookmarkToggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bookmarks Timeline */}
        <NoteActivityTimeline
          bookmarks={bookmarks}
          onRemoveBookmark={handleBookmarkToggle}
        />

        {/* Upload Note Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowUploadModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Upload Course Study Guide</h3>
                <p className="text-xs text-gray-500 mt-1">Share lecture summaries or study guides to help fellow students.</p>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Complete Dynamic Programming Midterm Review"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Course Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS 301"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Format</label>
                    <select
                      value={newFormat}
                      onChange={(e) => setNewFormat(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="goodnotes">GoodNotes Notebook</option>
                      <option value="docx">Word DOCX</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Course Full Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                    <select
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Chemistry">Chemistry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Estimated Pages</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newPageCount}
                      onChange={(e) => setNewPageCount(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trees, Big-O, Memoization"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Topics Covered</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Summarize key topics and exam preparation tips..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Note to Knowledge Repository
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
