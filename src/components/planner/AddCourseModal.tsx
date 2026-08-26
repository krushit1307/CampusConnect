import React, { useState } from 'react';
import { Course, CourseCategory } from '@/types/degreePlanner';
import { X, Search, Plus, BookOpen } from 'lucide-react';

interface AddCourseModalProps {
  isOpen: boolean;
  semesterId: string | null;
  onClose: () => void;
  onAddCourse: (semesterId: string, course: Course) => void;
  availableCourses: Course[];
}

export function AddCourseModal({
  isOpen,
  semesterId,
  onClose,
  onAddCourse,
  availableCourses,
}: AddCourseModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  if (!isOpen || !semesterId) return null;

  const filtered = availableCourses.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border-4 border-black rounded-lg max-w-xl w-full p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 border-2 border-black rounded hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-display font-black text-black mb-1">
          Add Course to Schedule
        </h2>
        <p className="text-xs font-mono text-gray-600 mb-4">
          Select courses from the catalog to add to this semester.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search CS 101, Linear Algebra..."
              className="w-full pl-9 pr-3 py-2 border-2 border-black rounded font-mono text-xs bg-white"
            />
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2 py-2 border-2 border-black rounded font-mono text-xs bg-white uppercase font-bold"
            >
              <option value="all">All Tracks</option>
              <option value="core">Core CS</option>
              <option value="math">Mathematics</option>
              <option value="systems">Systems</option>
              <option value="theory">Theory</option>
              <option value="ai">AI & ML</option>
              <option value="elective">Electives</option>
            </select>
          </div>
        </div>

        {/* Course Catalog List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.map((course) => (
            <div
              key={course.id}
              className="p-3 border-2 border-black rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-sm text-black">
                    {course.code}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 border border-black rounded-full font-bold">
                    {course.credits} Credits
                  </span>
                </div>
                <div className="font-mono text-xs text-gray-700 font-semibold mt-0.5">
                  {course.title}
                </div>
                {course.prerequisites.length > 0 && (
                  <div className="font-mono text-[10px] text-gray-500 mt-1">
                    Prereq: {course.prerequisites.join(', ')}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  onAddCourse(semesterId, course);
                  onClose();
                }}
                className="neu-border bg-lime hover:bg-lime/90 px-3 py-1.5 font-mono text-xs font-black uppercase text-black flex items-center gap-1 shrink-0"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
