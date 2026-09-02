'use client';

import { useState, useEffect } from 'react';
import { Event } from '@/types/events';
import { getEventWithVersion } from '@/lib/events/concurrency';

interface EventEditFormProps {
    eventId: string;
    initialEvent: Event;
    onSave: (updatedEvent: Event) => void;
    onCancel: () => void;
}

export default function EventEditForm({ eventId, initialEvent, onSave, onCancel }: EventEditFormProps) {
    const [title, setTitle] = useState(initialEvent.title);
    const [description, setDescription] = useState(initialEvent.description);
    const [location, setLocation] = useState(initialEvent.location);
    const [currentVersion, setCurrentVersion] = useState(initialEvent.version);

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOCCConflict, setIsOCCConflict] = useState(false);

    // Poll for version changes to warn user before they submit
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const latestEvent = await getEventWithVersion(eventId);
                if (latestEvent.version !== currentVersion) {
                    setIsOCCConflict(true);
                    setError('Warning: Another admin has modified this event. Your changes may overwrite theirs.');
                }
            } catch (err) {
                console.error('Failed to poll event version', err);
            }
        }, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, [eventId, currentVersion]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setIsOCCConflict(false);

        try {
            const response = await fetch(`/api/events/${eventId}/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    currentVersion,
                    title,
                    description,
                    location,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.isOCCError) {
                    setIsOCCConflict(true);
                    setCurrentVersion(data.currentVersion);
                    setError(data.error);
                } else {
                    throw new Error(data.error || 'Failed to save changes');
                }
                return;
            }

            onSave(data.event);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Event Details</h2>

            {error && (
                <div className={`p-4 rounded-lg border ${isOCCConflict
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                    }`}>
                    <p className="font-medium">{error}</p>
                    {isOCCConflict && (
                        <button
                            type="button"
                            onClick={async () => {
                                const latest = await getEventWithVersion(eventId);
                                setTitle(latest.title);
                                setDescription(latest.description);
                                setLocation(latest.location);
                                setCurrentVersion(latest.version);
                                setIsOCCConflict(false);
                                setError(null);
                            }}
                            className="mt-2 text-sm font-semibold underline hover:text-yellow-900 dark:hover:text-yellow-100"
                        >
                            Click here to load the latest changes and continue editing.
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={4}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSaving || isOCCConflict}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}
