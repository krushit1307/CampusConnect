import React from 'react';
import { BookOpen } from 'lucide-react';
import { ConstitutionSection } from '../../services/constitutionEngine';

interface ScrollSpySidebarProps {
    sections: ConstitutionSection[];
    activeSectionId: string;
    onSelectSection: (id: string) => void;
}

export const DocumentScrollSpyIndex: React.FC<ScrollSpySidebarProps> = ({ sections, activeSectionId, onSelectSection }) => {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase border-b border-slate-800 pb-2">
                <BookOpen className="w-4 h-4" /> Articles Index
            </div>

            <div className="space-y-1 text-xs">
                {sections.map(section => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => onSelectSection(section.id)}
                        className={`w-full text-left p-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                            activeSectionId === section.id
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                        }`}
                    >
                        <span className="font-mono text-[10px] opacity-70">{section.articleNumber}</span>
                        <span className="truncate">{section.title}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
