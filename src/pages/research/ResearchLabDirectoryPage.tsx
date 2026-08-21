import React, { useState } from 'react';
import { Microscope, Search, PlusCircle, CheckCircle2, FileText, Award, Layers } from 'lucide-react';
import {
    MOCK_RESEARCH_LABS,
    MOCK_APPLICATIONS,
    ResearchLabProject,
    ResearchApplicationRecord
} from '../../services/researchLabEngine';
import { ResearchLabCardTile } from '../../components/research/ResearchLabCardTile';
import { ResearchProposalSubmissionModal } from '../../components/research/ResearchProposalSubmissionModal';

export const ResearchLabDirectoryPage: React.FC = () => {
    const [labs] = useState<ResearchLabProject[]>(MOCK_RESEARCH_LABS);
    const [applications, setApplications] = useState<ResearchApplicationRecord[]>(MOCK_APPLICATIONS);
    const [selectedLabForApply, setSelectedLabForApply] = useState<ResearchLabProject | null>(null);
    const [activeTab, setActiveTab] = useState<'labs' | 'myApps'>('labs');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [deptFilter, setDeptFilter] = useState<string>('All');

    const filteredLabs = labs.filter(l => {
        const matchesSearch = l.labTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            l.principalInvestigator.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = deptFilter === 'All' || l.department.includes(deptFilter);
        return matchesSearch && matchesDept;
    });

    const handleOpenApplyModal = (lab: ResearchLabProject) => {
        setSelectedLabForApply(lab);
    };

    const handleFormSubmitProposal = (record: ResearchApplicationRecord) => {
        setApplications(prev => [record, ...prev]);
        setSelectedLabForApply(null);
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-100 font-sans p-4 sm:p-6">
            {/* Header Hub Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                            <Microscope className="w-4 h-4 text-indigo-400" /> Faculty Research & Innovation Hub
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1">
                            Undergraduate Research Lab Directory
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                            Explore faculty research opportunities, check active grant funding, match required technical skillsets, and submit direct research proposals for paid stipends or course credit.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted Applications</span>
                            <span className="text-lg font-black text-indigo-400 font-mono">{applications.length} Records</span>
                        </div>
                    </div>
                </div>

                {/* Filter & View Switcher */}
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start">
                        <button
                            type="button"
                            onClick={() => setActiveTab('labs')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                activeTab === 'labs'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Microscope className="w-4 h-4" /> Open Faculty Labs ({filteredLabs.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('myApps')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                activeTab === 'myApps'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <FileText className="w-4 h-4" /> My Applications ({applications.length})
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by lab title or Principal Investigator name..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                        >
                            <option value="All">All Departments</option>
                            <option value="Computer Science">Computer Science</option>
                            <option value="Bioengineering">Bioengineering</option>
                            <option value="Physics">Physics</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Grid Content */}
            {activeTab === 'labs' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredLabs.map(lab => (
                        <ResearchLabCardTile
                            key={lab.id}
                            lab={lab}
                            hasApplied={applications.some(a => a.labProjectId === lab.id)}
                            onApply={handleOpenApplyModal}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {applications.map(app => (
                        <div key={app.id} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-100">{app.labTitle}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                                    app.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                    app.status === 'Interview Scheduled' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                    'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                                }`}>
                                    {app.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{app.statementOfInterest}</p>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                                <span>Applicant: {app.applicantName} (GPA: {app.gpa})</span>
                                <span>Submitted: {app.submissionDate}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Submission Modal */}
            {selectedLabForApply && (
                <ResearchProposalSubmissionModal
                    lab={selectedLabForApply}
                    onClose={() => setSelectedLabForApply(null)}
                    onSubmitProposal={handleFormSubmitProposal}
                />
            )}
        </div>
    );
};

export default ResearchLabDirectoryPage;
