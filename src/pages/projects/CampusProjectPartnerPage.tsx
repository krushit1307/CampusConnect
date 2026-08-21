import React, { useState } from 'react';
import {
  CampusProjectServiceHandler,
} from '../../backend/src/services/CampusProjectService';
import {
  ProjectPost,
  ApplicationRequest,
  ProjectFilterOptions,
} from '../../backend/src/models/CampusProjectModel';
import { ProjectPostCard } from '../../src/components/projects/ProjectPostCard';
import { ProjectActivityTimeline } from '../../src/components/projects/ProjectActivityTimeline';
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Code,
  Rocket,
} from 'lucide-react';

export const CampusProjectPartnerPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectPost[]>(() =>
    CampusProjectServiceHandler.fetchProjectListings()
  );
  const [applications, setApplications] = useState<ApplicationRequest[]>(() =>
    CampusProjectServiceHandler.fetchUserApplications()
  );

  const [filters, setFilters] = useState<ProjectFilterOptions>({
    department: 'All',
    projectType: 'All',
    searchQuery: '',
  });

  const [selectedProject, setSelectedProject] = useState<ProjectPost | null>(null);
  const [applicantName, setApplicantName] = useState<string>('Alex Mercer');
  const [applicantRole, setApplicantRole] = useState<string>('Fullstack Junior');
  const [appliedRole, setAppliedRole] = useState<string>('');
  const [pitch, setPitch] = useState<string>('');
  const [skills, setSkills] = useState<string>('React, TypeScript, TailwindCSS');
  const [isApplySuccess, setIsApplySuccess] = useState<boolean>(false);

  // Create Project State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCourseCode, setNewCourseCode] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('Computer Science');
  const [newProjectType, setNewProjectType] = useState<'capstone' | 'hackathon' | 'research' | 'coursework'>('capstone');
  const [newTeamSize, setNewTeamSize] = useState<number>(4);
  const [newOpenRoles, setNewOpenRoles] = useState<string>('Frontend Developer, ML Engineer');
  const [newRequiredSkills, setNewRequiredSkills] = useState<string>('Python, PyTorch, React');
  const [newDescription, setNewDescription] = useState<string>('');

  const applyFilterChanges = (updatedFilters: Partial<ProjectFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setProjects(CampusProjectServiceHandler.fetchProjectListings(nextFilters));
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    CampusProjectServiceHandler.submitProjectApplication(
      selectedProject.id,
      applicantName,
      applicantRole,
      appliedRole || selectedProject.openRoles[0] || "Collaborator",
      pitch,
      skills.split(',').map((s) => s.trim())
    );

    setApplications(CampusProjectServiceHandler.fetchUserApplications());
    setIsApplySuccess(true);
    setTimeout(() => {
      setIsApplySuccess(false);
      setSelectedProject(null);
    }, 1800);
  };

  const handleDecision = (appId: string, status: 'accepted' | 'declined') => {
    CampusProjectServiceHandler.updateApplicationDecision(appId, status);
    setApplications(CampusProjectServiceHandler.fetchUserApplications());
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    CampusProjectServiceHandler.createNewProjectPost({
      title: newTitle,
      courseCode: newCourseCode,
      department: newDepartment,
      projectType: newProjectType,
      ownerName: "Alex Mercer",
      ownerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      ownerRole: "Senior Student",
      teamSize: newTeamSize,
      openRoles: newOpenRoles.split(',').map((r) => r.trim()),
      requiredSkills: newRequiredSkills.split(',').map((s) => s.trim()),
      description: newDescription,
    });

    setProjects(CampusProjectServiceHandler.fetchProjectListings(filters));
    setShowCreateModal(false);
    setNewTitle('');
    setNewCourseCode('');
    setNewDescription('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-200">
              <Sparkles className="w-4 h-4 text-blue-300" />
              Student Collaboration Network
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Campus Project Partner & Hackathon Collaborator Finder
            </h1>
            <p className="text-blue-200 text-base sm:text-lg leading-relaxed">
              Find teammate partners for Senior Capstones, Hackathons, Course Projects, and Research Labs. Connect with skilled student developers, designers, and researchers.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-blue-600" />
                Post Project Need
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
                placeholder="Search by project title, course code (e.g. CS 490), open roles, or tech stack..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm text-gray-900"
              />
            </div>

            {/* Department Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.department}
                onChange={(e) => applyFilterChanges({ department: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Departments</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
              </select>

              {/* Project Type Dropdown */}
              <select
                value={filters.projectType}
                onChange={(e) => applyFilterChanges({ projectType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Project Types</option>
                <option value="capstone">Senior Capstone</option>
                <option value="hackathon">Hackathon</option>
                <option value="research">Research Lab</option>
              </select>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Active Project Opportunities ({projects.length})
            </h2>
          </div>

          {projects.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No project posts found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or department filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <ProjectPostCard
                  key={proj.id}
                  project={proj}
                  onApplyClick={(p) => {
                    setSelectedProject(p);
                    setAppliedRole(p.openRoles[0] || '');
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Applications Timeline */}
        <ProjectActivityTimeline
          applications={applications}
          onDecision={handleDecision}
        />

        {/* Apply Modal */}
        {selectedProject && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isApplySuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Application Submitted!</h3>
                  <p className="text-sm text-gray-600">
                    Your application for "{selectedProject.title}" has been sent to {selectedProject.ownerName}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleApplySubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedProject.title}</h3>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                      Project Lead: {selectedProject.ownerName}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Role Applying For</label>
                      <select
                        value={appliedRole}
                        onChange={(e) => setAppliedRole(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                      >
                        {selectedProject.openRoles.map((role, idx) => (
                          <option key={idx} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Your Relevant Skills</label>
                      <input
                        type="text"
                        required
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Short Pitch / Background</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Explain why you want to join this project team and your background..."
                        value={pitch}
                        onChange={(e) => setPitch(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Submit Team Application
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Post Project Opportunity</h3>
                <p className="text-xs text-gray-500 mt-1">Recruit student collaborators for capstones or hackathons.</p>
              </div>

              <form onSubmit={handleCreateProjectSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Blockchain Voting Protocol"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Course Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS 490"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Project Type</label>
                    <select
                      value={newProjectType}
                      onChange={(e) => setNewProjectType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                    >
                      <option value="capstone">Senior Capstone</option>
                      <option value="hackathon">Hackathon</option>
                      <option value="research">Research Lab</option>
                      <option value="coursework">Coursework</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                    <select
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Electrical Engineering">Electrical Engineering</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Total Team Size</label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={newTeamSize}
                      onChange={(e) => setNewTeamSize(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Open Roles (comma separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Frontend Developer, ML Engineer"
                    value={newOpenRoles}
                    onChange={(e) => setNewOpenRoles(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Required Skills (comma separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Python, PyTorch, React"
                    value={newRequiredSkills}
                    onChange={(e) => setNewRequiredSkills(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description & Goals</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe project objectives and scope..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Project Opportunity
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
