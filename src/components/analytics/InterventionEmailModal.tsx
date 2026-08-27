'use client';

import { useState } from 'react';

interface InterventionEmailModalProps {
    studentName: string;
    seriesName: string;
    onClose: () => void;
    onSend: () => Promise<void>;
}

export default function InterventionEmailModal({ studentName, seriesName, onClose, onSend }: InterventionEmailModalProps) {
    const [isSending, setIsSending] = useState(false);
    const [customMessage, setCustomMessage] = useState('');

    const handleSend = async () => {
        setIsSending(true);
        try {
            await onSend();
            onClose();
        } catch (error) {
            console.error('Failed to send intervention email:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Send Intervention Email
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    You are about to send a proactive check-in email to <span className="font-semibold">{studentName}</span> regarding their engagement in <span className="font-semibold">{seriesName}</span>.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Default Message (Editable)
                    </label>
                    <textarea
                        value={`Hi ${studentName},\n\nWe noticed you might be falling behind in the ${seriesName} series. We want to make sure you have everything you need to succeed. Do you need any help with the material or have any questions about upcoming sessions?\n\n${customMessage ? '\n\nAdditional Note:\n' + customMessage : ''}\n\nBest regards,\nEvent Organizer`}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors flex items-center space-x-2"
                    >
                        {isSending ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Sending...</span>
                            </>
                        ) : (
                            <span>Send 1-Click Intervention</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
