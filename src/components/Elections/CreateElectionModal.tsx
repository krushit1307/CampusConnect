// =============================================================================
// Component: CreateElectionModal
//  Issue: #3554 - Implement 'Secure Executive Board Election Voting with Anonymity'
//  Description: Admin UI for Club Executives to create a new election. Allows
//  adding candidates, setting the position, and defining the voting window.
//  =============================================================================

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Candidate } from '../../hooks/useClubElections';

interface CreateElectionModalProps {
    clubId: string;
    onClose: () => void;
    onCreated: () => void;
}

export const CreateElectionModal: React.FC<CreateElectionModalProps> = ({ clubId, onClose, onCreated }) => {
    const [position, setPosition] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [candidates, setCandidates] = useState<Candidate[]>([
        { id: '1', name: '', platform: '' },
        { id: '2', name: '', platform: '' }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addCandidate = () => {
        setCandidates(prev => [...prev, { id: String(prev.length + 1), name: '', platform: '' }]);
    };

    const updateCandidate = (index: number, field: keyof Candidate, value: string) => {
        setCandidates(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
    };

    const removeCandidate = (index: number) => {
        if (candidates.length <= 2) return;
        setCandidates(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!position || !startDate || !endDate) {
            setError('Please fill in all required fields.');
            return;
        }

        const validCandidates = candidates.filter(c => c.name.trim() !== '');
        if (validCandidates.length < 2) {
            setError('You must add at least 2 candidates.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Check conflict of interest for each candidate
            for (const candidate of validCandidates) {
                if (candidate.id && candidate.id.length > 5) { // User UUID
                    const { data: coiCheck } = await supabase.rpc('verify_candidate_conflict_of_interest', {
                        p_club_id: clubId,
                        p_candidate_user_id: candidate.id,
                        p_position: position
                    });
                    if (coiCheck?.has_conflict) {
                        setError(coiCheck.message || `Candidate ${candidate.name} has a conflict of interest.`);
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            const { error: insertError } = await supabase
                .from('club_elections')
                .insert({
                    club_id: clubId,
                    position,
                    description,
                    candidates_json: validCandidates,
                    start_date: new Date(startDate).toISOString(),
                    end_date: new Date(endDate).toISOString(),
                    status: new Date(startDate) <= new Date() ? 'active' : 'draft'
                });

            if (insertError) throw insertError;

            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create election.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Election</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Position Title *</label>
                        <input
                            type="text"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            placeholder="e.g., President, Treasurer"
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Brief description of the role's responsibilities..."
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Start Date *</label>
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">End Date *</label>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Candidates *</label>
                            <button
                                type="button"
                                onClick={addCandidate}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                + Add Candidate
                            </button>
                        </div>

                        <div className="space-y-3">
                            {candidates.map((candidate, idx) => (
                                <div key={candidate.id} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Candidate {idx + 1}</span>
                                        {candidates.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeCandidate(idx)}
                                                className="text-xs text-red-500 hover:text-red-700"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={candidate.name}
                                        onChange={(e) => updateCandidate(idx, 'name', e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                        required
                                    />
                                    <textarea
                                        value={candidate.platform}
                                        onChange={(e) => updateCandidate(idx, 'platform', e.target.value)}
                                        rows={2}
                                        placeholder="Platform / Campaign Statement"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 font-medium">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-md">
                        {isSubmitting ? 'Creating...' : 'Create Election'}
                    </button>
                </div>
            </div>
        </div>
    );
};
