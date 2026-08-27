import React, { useState } from 'react';
import { Search, Filter, BookOpen, Download, Star, Bookmark, Share2, UploadCloud, Eye, Tag, CheckCircle, ShieldAlert, Sparkles, TrendingUp, Layers, FolderPlus } from 'lucide-react';
import ResourceCard from '../../components/academic/ResourceCard';
import ResourceAnalyticsTimeline from '../../components/academic/ResourceAnalyticsTimeline';

export interface AcademicResource {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  department: string;
  semester: string;
  resourceType: 'Syllabus' | 'Lecture Notes' | 'Past Exam' | 'Research Paper' | 'Lab Guide';
  fileSize: string;
  fileFormat: 'PDF' | 'DOCX' | 'ZIP' | 'EPUB';
  author: {
    name: string;
    avatar: string;
    role: string;
    verified: boolean;
  };
  downloadsCount: number;
  rating: number;
  reviewsCount: number;
  tags: string[];
  uploadDate: string;
  description: string;
  isBookmarked?: boolean;
}

const SAMPLE_RESOURCES: AcademicResource[] = [
  {
    id: 'res-101',
    title: 'Advanced Data Structures & Algorithms Comprehensive Study Pack',
    courseCode: 'CS301',
    courseName: 'Data Structures and Algorithms',
    department: 'Computer Science',
    semester: 'Fall 2025',
    resourceType: 'Lecture Notes',
    fileSize: '14.2 MB',
    fileFormat: 'PDF',
    author: {
      name: 'Dr. Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      role: 'Associate Professor',
      verified: true,
    },
    downloadsCount: 1420,
    rating: 4.9,
    reviewsCount: 88,
    tags: ['Graph Theory', 'Dynamic Programming', 'Red-Black Trees', 'Complexity Analysis'],
    uploadDate: '2025-10-12',
    description: 'Complete annotated lecture slides, problem sets with solution guides, and algorithm trace visual representations for CS301.',
    isBookmarked: true,
  },
  {
    id: 'res-102',
    title: 'Quantum Mechanics & Field Theory Past Midterm & Final Exams (2020-2025)',
    courseCode: 'PHYS402',
    courseName: 'Quantum Physics II',
    department: 'Physics',
    semester: 'Spring 2025',
    resourceType: 'Past Exam',
    fileSize: '8.7 MB',
    fileFormat: 'ZIP',
    author: {
      name: 'Prof. Marcus Vance',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      role: 'Department Head',
      verified: true,
    },
    downloadsCount: 890,
    rating: 4.8,
    reviewsCount: 42,
    tags: ['Schrödinger Equation', 'Bra-Ket Notation', 'Perturbation Theory', 'Solutions Included'],
    uploadDate: '2025-11-04',
    description: 'Curated 5-year repository of examinations complete with step-by-step mathematical proofs and grading rubrics.',
    isBookmarked: false,
  },
  {
    id: 'res-103',
    title: 'Organic Synthesis & Spectroscopic Methods Laboratory Handbook',
    courseCode: 'CHEM210',
    courseName: 'Organic Chemistry Lab',
    department: 'Chemistry',
    semester: 'Fall 2025',
    resourceType: 'Lab Guide',
    fileSize: '22.5 MB',
    fileFormat: 'PDF',
    author: {
      name: 'Sarah Jenkins',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      role: 'Graduate Teaching Assistant',
      verified: true,
    },
    downloadsCount: 654,
    rating: 4.7,
    reviewsCount: 31,
    tags: ['NMR Spectroscopy', 'Chromatography', 'Safety Protocols', 'Reagent Calculations'],
    uploadDate: '2025-09-18',
    description: 'Safety guidelines, experimental setups, spectral reference guides, and sample calculation templates.',
    isBookmarked: false,
  },
  {
    id: 'res-104',
    title: 'Decentralized Consensus Protocols in Distributed Systems',
    courseCode: 'CS580',
    courseName: 'Distributed Enterprise Systems',
    department: 'Computer Science',
    semester: 'Winter 2025',
    resourceType: 'Research Paper',
    fileSize: '4.1 MB',
    fileFormat: 'PDF',
    author: {
      name: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      role: 'Senior Researcher',
      verified: true,
    },
    downloadsCount: 1105,
    rating: 5.0,
    reviewsCount: 64,
    tags: ['Byzantine Fault Tolerance', 'Raft Consensus', 'Distributed Ledger', 'Peer-to-Peer'],
    uploadDate: '2025-12-01',
    description: 'Peer-reviewed comparative survey paper evaluating Raft, Paxos, and Tendermint consensus latency and scalability limits.',
    isBookmarked: true,
  },
];

export default function AcademicResourceHubPage() {
  const [resources, setResources] = useState<AcademicResource[]>(SAMPLE_RESOURCES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedResourceModal, setSelectedResourceModal] = useState<AcademicResource | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'timeline' | 'bookmarks'>('browse');

  const departments = ['All', 'Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Engineering'];
  const resourceTypes = ['All', 'Lecture Notes', 'Past Exam', 'Lab Guide', 'Research Paper', 'Syllabus'];

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          res.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          res.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = selectedDepartment === 'All' || res.department === selectedDepartment;
    const matchesType = selectedType === 'All' || res.resourceType === selectedType;
    const matchesTab = activeTab !== 'bookmarks' || res.isBookmarked;

    return matchesSearch && matchesDept && matchesType && matchesTab;
  });

  const toggleBookmark = (id: string) => {
    setResources(prev =>
      prev.map(item => item.id === id ? { ...item, isBookmarked: !item.isBookmarked } : item)
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-mx-auto mb-8 bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> CampusConnect Core Hub
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> +24% activity this week
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              Academic Resource & Knowledge Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Explore peer-verified lecture notes, examination archives, research papers, and lab manuals shared across departments.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 border border-indigo-400/20 text-sm">
              <UploadCloud className="w-4 h-4" /> Share Resource
            </button>
            <button className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-4 py-3 rounded-xl font-medium transition border border-slate-700 text-sm flex items-center gap-2">
              <FolderPlus className="w-4 h-4" /> Create Collection
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs & Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'browse'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Browse Repository
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-4 h-4" /> Activity Timeline
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'bookmarks'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bookmark className="w-4 h-4" /> Saved Items ({resources.filter(r => r.isBookmarked).length})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search course, code, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'timeline' ? (
          <ResourceAnalyticsTimeline />
        ) : (
          <>
            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Resource Category</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {resourceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => { setSearchQuery(''); setSelectedDepartment('All'); setSelectedType('All'); }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm transition border border-slate-700 flex items-center justify-center gap-2"
                >
                  <Filter className="w-4 h-4" /> Reset Filters
                </button>
              </div>
            </div>

            {/* Resource Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onBookmark={() => toggleBookmark(resource.id)}
                  onInspect={() => setSelectedResourceModal(resource)}
                />
              ))}
            </div>

            {filteredResources.length === 0 && (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No academic resources matching criteria</h3>
                <p className="text-slate-500 text-sm mt-1">Try updating your filters or search keywords.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Popup Component */}
      {selectedResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedResourceModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-md font-semibold border border-indigo-500/30">
                {selectedResourceModal.courseCode}
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-md font-semibold">
                {selectedResourceModal.resourceType}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{selectedResourceModal.title}</h2>
            <p className="text-slate-400 text-sm mb-4">{selectedResourceModal.description}</p>

            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-6">
              <img
                src={selectedResourceModal.author.avatar}
                alt={selectedResourceModal.author.name}
                className="w-12 h-12 rounded-full border border-indigo-500/40"
              />
              <div>
                <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                  {selectedResourceModal.author.name}
                  {selectedResourceModal.author.verified && (
                    <CheckCircle className="w-4 h-4 text-emerald-400 inline" />
                  )}
                </div>
                <div className="text-slate-400 text-xs">{selectedResourceModal.author.role} • {selectedResourceModal.department}</div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedResourceModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm transition"
              >
                Close
              </button>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm transition font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                <Download className="w-4 h-4" /> Download File ({selectedResourceModal.fileSize})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
