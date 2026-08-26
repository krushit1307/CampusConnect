import React, { useState } from 'react';
import {
  CampusTutorServiceHandler,
} from '../../backend/src/services/CampusTutorService';
import {
  TutorProfile,
  BookingSession,
  TutorFilterOptions,
} from '../../backend/src/models/CampusTutorModel';
import { TutorProfileCard } from '../../src/components/tutors/TutorProfileCard';
import { TutorActivityTimeline } from '../../src/components/tutors/TutorActivityTimeline';
import {
  GraduationCap,
  Search,
  Filter,
  PlusCircle,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  X,
} from 'lucide-react';

export const CampusCourseTutorPage: React.FC = () => {
  const [tutors, setTutors] = useState<TutorProfile[]>(() =>
    CampusTutorServiceHandler.fetchTutorList()
  );
  const [bookings, setBookings] = useState<BookingSession[]>(() =>
    CampusTutorServiceHandler.fetchStudentBookings()
  );

  const [filters, setFilters] = useState<TutorFilterOptions>({
    department: 'All',
    maxHourlyRate: 50,
    minRating: 0,
    verifiedOnly: false,
    searchQuery: '',
  });

  const [selectedTutor, setSelectedTutor] = useState<TutorProfile | null>(null);
  const [sessionType, setSessionType] = useState<'one-on-one' | 'group' | 'exam-prep'>('one-on-one');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [scheduledTime, setScheduledTime] = useState<string>('Tomorrow, 4:00 PM');
  const [studentName, setStudentName] = useState<string>('Alex Mercer');
  const [isBookingSuccess, setIsBookingSuccess] = useState<boolean>(false);

  // New Tutor Registration State
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [newTutorName, setNewTutorName] = useState<string>('');
  const [newCourseCode, setNewCourseCode] = useState<string>('');
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('Computer Science');
  const [newGrade, setNewGrade] = useState<string>('A+');
  const [newHourlyRate, setNewHourlyRate] = useState<number>(25);
  const [newBio, setNewBio] = useState<string>('');
  const [newSubjects, setNewSubjects] = useState<string>('Algorithms, Data Structures');

  const applyFilterChanges = (updatedFilters: Partial<TutorFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setTutors(CampusTutorServiceHandler.fetchTutorList(nextFilters));
  };

  const handleBookSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTutor) return;

    CampusTutorServiceHandler.scheduleTutorSession(
      selectedTutor.id,
      studentName,
      scheduledTime,
      durationMinutes,
      sessionType
    );

    setBookings(CampusTutorServiceHandler.fetchStudentBookings());
    setIsBookingSuccess(true);
    setTimeout(() => {
      setIsBookingSuccess(false);
      setSelectedTutor(null);
    }, 1800);
  };

  const handleCancelBooking = (id: string) => {
    CampusTutorServiceHandler.cancelScheduledSession(id);
    setBookings(CampusTutorServiceHandler.fetchStudentBookings());
  };

  const handleRegisterTutorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    CampusTutorServiceHandler.registerAsTutor({
      tutorName: newTutorName,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      courseCode: newCourseCode,
      courseTitle: newCourseTitle,
      department: newDepartment,
      gradeAchieved: newGrade,
      hourlyRate: newHourlyRate,
      verifiedStudent: true,
      bio: newBio,
      subjects: newSubjects.split(",").map((s) => s.strip ? s.strip() : s.trim()),
      availability: ["Mon 4-6 PM", "Thu 2-5 PM"],
    });

    setTutors(CampusTutorServiceHandler.fetchTutorList(filters));
    setShowRegisterModal(false);
    setNewTutorName('');
    setNewCourseCode('');
    setNewCourseTitle('');
    setNewBio('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Hero Section */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              Verified Peer Academic Network
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Campus Course Tutor & Exam Prep Marketplace
            </h1>
            <p className="text-indigo-200 text-base sm:text-lg leading-relaxed">
              Connect with top-performing peer tutors who aced your exact course codes. Book 1-on-1 sessions, exam prep review, and algorithm crash courses.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Become a Peer Tutor
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
                placeholder="Search by tutor name, course code (e.g. CS 301), or topic..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-gray-900"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.department}
                onChange={(e) => applyFilterChanges({ department: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Physics">Physics</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tutor Grid Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              Available Peer Tutors ({tutors.length})
            </h2>
          </div>

          {tutors.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No peer tutors found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search query or department filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {tutors.map((tutor) => (
                <TutorProfileCard
                  key={tutor.id}
                  tutor={tutor}
                  onBookClick={(t) => setSelectedTutor(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity & Bookings Timeline */}
        <TutorActivityTimeline
          bookings={bookings}
          onCancelBooking={handleCancelBooking}
        />

        {/* Booking Modal */}
        {selectedTutor && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedTutor(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isBookingSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Session Confirmed!</h3>
                  <p className="text-sm text-gray-600">
                    Your peer tutoring booking with {selectedTutor.tutorName} for {selectedTutor.courseCode} has been scheduled.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleBookSessionSubmit} className="space-y-5">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <img
                      src={selectedTutor.avatarUrl}
                      alt={selectedTutor.tutorName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{selectedTutor.tutorName}</h3>
                      <p className="text-xs text-indigo-600 font-semibold">
                        {selectedTutor.courseCode}: {selectedTutor.courseTitle}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Student Full Name</label>
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Session Type</label>
                      <select
                        value={sessionType}
                        onChange={(e) => setSessionType(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                      >
                        <option value="one-on-one">1-on-1 Tutoring Session (Standard)</option>
                        <option value="exam-prep">Exam Prep Intensive (+25% rate)</option>
                        <option value="group">Group Study Session (-20% rate)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Duration</label>
                        <select
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                        >
                          <option value={60}>60 Minutes</option>
                          <option value={90}>90 Minutes</option>
                          <option value={120}>120 Minutes</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Time Slot</label>
                        <input
                          type="text"
                          required
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50/70 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Price:</span>
                    <span className="text-2xl font-extrabold text-indigo-900">
                      ${Math.round(selectedTutor.hourlyRate * (durationMinutes / 60) * (sessionType === 'exam-prep' ? 1.25 : sessionType === 'group' ? 0.8 : 1.0))}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Confirm & Schedule Session
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Tutor Registration Modal */}
        {showRegisterModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Register as a Peer Tutor</h3>
                <p className="text-xs text-gray-500 mt-1">Help fellow students ace courses you earned high grades in.</p>
              </div>

              <form onSubmit={handleRegisterTutorSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Lee"
                    value={newTutorName}
                    onChange={(e) => setNewTutorName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Grade Achieved</label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="A+">A+</option>
                      <option value="A">A</option>
                      <option value="A-">A-</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                    <select
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Physics">Physics</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Hourly Rate ($)</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={newHourlyRate}
                      onChange={(e) => setNewHourlyRate(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Bio / Tutoring Focus</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Briefly describe your tutoring approach and background..."
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Create Tutor Profile
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
