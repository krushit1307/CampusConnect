import React from 'react';
import { Tag, Check } from 'lucide-react';
import { CAMPUS_INTEREST_TAGS } from '../../services/onboardingProfileEngine';

interface InterestSelectorProps {
    selectedInterests: string[];
    onToggleTag: (tag: string) => void;
}

export const CampusInterestTagSelector: React.FC<InterestSelectorProps> = ({ selectedInterests, onToggleTag }) => {
    return (
        <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Select 3+ Campus Interests:</span>
            <div className="flex flex-wrap gap-2">
                {CAMPUS_INTEREST_TAGS.map(tag => {
                    const isSelected = selectedInterests.includes(tag);
                    return (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => onToggleTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isSelected
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                            <span>{tag}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
