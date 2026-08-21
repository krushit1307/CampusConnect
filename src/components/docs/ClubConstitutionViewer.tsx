import React, { useState } from 'react';
import { FileText, Search, Download, ShieldCheck } from 'lucide-react';
import { MOCK_CLUB_CONSTITUTION, ConstitutionSection } from '../../services/constitutionEngine';
import { DocumentScrollSpyIndex } from './DocumentScrollSpyIndex';

export const ClubConstitutionViewer: React.FC = () => {
    const [sections] = useState<ConstitutionSection[]>(MOCK_CLUB_CONSTITUTION);
    const [activeSectionId, setActiveSectionId] = useState<string>("art_1");
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredSections = sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            {/* Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                        <FileText className="w-4 h-4" /> Official Student Organization Bylaws
                    </div>
                    <button
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5 text-indigo-400" /> Export PDF
                    </button>
                </div>
                <h1 className="text-2xl font-black text-slate-100">CS & AI Association Club Constitution</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* ScrollSpy Sidebar */}
                <div className="md:col-span-1">
                    <DocumentScrollSpyIndex
                        sections={sections}
                        activeSectionId={activeSectionId}
                        onSelectSection={(id) => setActiveSectionId(id)}
                    />
                </div>

                {/* Article Content Display */}
                <div className="md:col-span-3 space-y-4">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search constitution articles & sections..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="space-y-4">
                        {filteredSections.map((section) => (
                            <div
                                key={section.id}
                                id={section.id}
                                className={`p-6 bg-slate-900 border rounded-3xl space-y-2 transition-all ${
                                    activeSectionId === section.id
                                        ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/5'
                                        : 'border-slate-800/80'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-mono text-[10px] font-bold uppercase">
                                        {section.articleNumber}
                                    </span>
                                    <h3 className="text-base font-bold text-slate-100">{section.title}</h3>
                                </div>

                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950 p-4 rounded-2xl border border-slate-800/60">
                                    {section.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClubConstitutionViewer;
