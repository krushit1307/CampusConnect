import React, { useState } from 'react';
import { X, Send, Award, FileText, CheckCircle2 } from 'lucide-react';
import { ResearchLabProject, ResearchApplicationRecord } from '../../services/researchLabEngine';

interface ModalProps {
    lab: ResearchLabProject;
    onClose: () => void;
    onSubmitProposal: (record: ResearchApplicationRecord) => void;
}

export const ResearchProposalSubmissionModal: React.FC<ModalProps> = ({ lab, onClose, onSubmitProposal }) => {
    const [applicantName, setApplicantName] = useState<string>('Dipanshu Batra');
    const [gpa, setGpa] = useState<number>(3.92);
    const [statement, setStatement] = useState<string>('');
    const [experience, setExperience] = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!statement.trim()) return;

        const record: ResearchApplicationRecord = {
            id: `app_${Date.now()}`,
            labProjectId: lab.id,
            labTitle: lab.labTitle,
            applicantName,
            gpa,
            statementOfInterest: statement.trim(),
            relevantExperience: experience.trim(),
            submissionDate: "Just Now",
            status: "Pending Review"
        };

        onSubmitProposal(record);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-5 top-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                >
                    <X className="w-4 h-4" />
                </button>

                <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold uppercase">
                        Undergraduate Research Application
                    </span>
                    <h2 className="text-xl font-black text-slate-100 mt-1">{lab.labTitle}</h2>
                    <p className="text-xs text-slate-400">Principal Investigator: {lab.principalInvestigator}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Applicant Full Name</label>
                            <input
                                type="text"
                                value={applicantName}
                                onChange={(e) => setApplicantName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Cumulative GPA</label>
                            <input
                                type="number"
                                step="0.01"
                                value={gpa}
                                onChange={(e) => setGpa(parseFloat(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Statement of Research Interest</label>
                        <textarea
                            rows={3}
                            value={statement}
                            onChange={(e) => setStatement(e.target.value)}
                            placeholder="Explain why you want to join this lab and how your academic goals align..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Relevant Coursework & Technical Projects</label>
                        <textarea
                            rows={2}
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="List relevant software tools, lab techniques, or projects..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
                        >
                            <Send className="w-4 h-4" /> Submit Proposal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
