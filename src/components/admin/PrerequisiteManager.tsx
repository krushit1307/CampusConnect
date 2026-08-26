// =============================================================================
// Component: PrerequisiteManager
// Issue: #3224 - Implement 'Event Series Dependencies'(Prerequisites)
// Description: Admin UI for Club Executives to configure event prerequisites.
// Allows selecting past events as requirements, toggling conditional RSVPs,
// and managing manual overrides for specific students.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface PrerequisiteManagerProps {
    eventId: string;
    clubId: string;
}

interface PastEvent {
    id: string;
    title: string;
    event_date: string;
}

export const PrerequisiteManager: React.FC<PrerequisiteManagerProps> = ({ eventId, clubId }) => {
    const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
    const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
    const [allowConditional, setAllowConditional] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchData();
    }, [eventId, clubId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch current event config
            const { data: eventConfig } = await supabase
                .from('events')
                .select('prerequisite_event_ids, allow_conditional_rsvp')
                .eq('id', eventId)
                .single();

            if (eventConfig) {
                setSelectedPrereqs(eventConfig.prerequisite_event_ids || []);
                setAllowConditional(eventConfig.allow_conditional_rsvp || false);
            }

            // Fetch past events from the same club to use as prerequisite options
            const { data: past } = await supabase
                .from('events')
                .select('id, title, event_date')
                .eq('club_id', clubId)
                .lt('event_date', new Date().toISOString())
                .neq('id', eventId)
                .order('event_date', { ascending: false })
                .limit(50);

            setPastEvents((past as PastEvent[]) || []);
        } catch (err) {
            console.error('Failed to fetch prerequisite data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const { error } = await supabase
                .from('events')
                .update({
                    prerequisite_event_ids: selectedPrereqs,
                    allow_conditional_rsvp: allowConditional
                })
                .eq('id', eventId);

            if (error) throw error;
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            alert('Failed to save prerequisites: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const togglePrereq = (id: string) => {
        setSelectedPrereqs(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    if (isLoading) {
        return <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Event Prerequisites
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Require attendees to have physically attended previous events in this series before they can RSVP.
                </p>
            </div>

            {/* Prerequisite Selection */}
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Required Past Events
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1 custom-scrollbar">
                    {pastEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No past events available.</p>
                    ) : (
                        pastEvents.map(event => (
                            <label key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedPrereqs.includes(event.id)}
                                    onChange={() => togglePrereq(event.id)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(event.event_date).toLocaleDateString()}
                                    </p>
                                </div>
                            </label>
                        ))
                    )}
                </div>
            </div>

            {/* Conditional RSVP Toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-1">
                        <input
                            type="checkbox"
                            checked={allowConditional}
                            onChange={(e) => setAllowConditional(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white block">Allow Conditional Pre-Registration</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Allow students to RSVP now, but automatically revoke their ticket if they fail to attend the prerequisite sessions.
                        </span>
                    </div>
                </label>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-4">
                {saveSuccess && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Saved successfully
                    </span>
                )}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="ml-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm"
                >
                    {isSaving ? 'Saving...' : 'Save Prerequisites'}
                </button>
            </div>
        </div>
    );
};
