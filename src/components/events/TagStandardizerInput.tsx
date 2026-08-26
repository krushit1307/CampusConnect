// =============================================================================
// Component: TagStandardizerInput
// Issue: #3711 - Implement 'Automated "Event Tag" Standardization'
// Description: Tag input that live-normalizes free-text entries against the
// canonical dictionary via Fuse.js. Shows the standardized replacement, flags
// novel tags for admin review, and renders removable chips (dark/light aware).
// =============================================================================

import React, { useState } from 'react';
import { useTagStandardization } from '../../hooks/useTagStandardization';

interface TagStandardizerInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
}

export const TagStandardizerInput: React.FC<TagStandardizerInputProps> = ({ value, onChange }) => {
    const { normalize, isLoading } = useTagStandardization();
    const [draft, setDraft] = useState('');
    const [notice, setNotice] = useState<string | null>(null);

    const addTag = () => {
        const raw = draft.trim();
        if (!raw) return;

        const { standardized, novel } = normalize([raw]);

        if (standardized.length > 0) {
            const next = Array.from(new Set([...value, ...standardized]));
            onChange(next);
            if (standardized[0].toLowerCase() !== raw.toLowerCase()) {
                setNotice(`"${raw}" standardized to "${standardized[0]}".`);
            } else {
                setNotice(null);
            }
        } else if (novel.length > 0) {
            // Novel tag: keep it but flag for admin review
            onChange(Array.from(new Set([...value, raw])));
            setNotice(`"${raw}" is a new tag — submitted for admin review.`);
        }
        setDraft('');
    };

    const removeTag = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            removeTag(value[value.length - 1]);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                Event Tags
            </label>

            {/* Chip container + input */}
            <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 min-h-[46px]">
                {value.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 rounded-full text-xs font-bold"
                    >
                        {tag}
                        <button
                            onClick={() => removeTag(tag)}
                            className="text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200"
                            aria-label={`Remove ${tag}`}
                        >
                            ✕
                        </button>
                    </span>
                ))}
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addTag}
                    placeholder={isLoading ? 'Loading dictionary…' : 'Type a tag and press Enter'}
                    disabled={isLoading}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
            </div>

            {/* Standardization notice */}
            {notice && (
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{notice}</p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
                Tags are auto-standardized against the campus taxonomy (e.g. "compsci" → "Computer Science"). Novel tags are reviewed by admins.
            </p>
        </div>
    );
};
