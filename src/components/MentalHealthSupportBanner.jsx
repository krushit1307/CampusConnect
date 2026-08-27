// src/components/MentalHealthSupportBanner.jsx

import React, { useState, useEffect } from 'react';

export default function MentalHealthSupportBanner({ websocket }) {
    const [supportAlert, setSupportAlert] = useState(null);

    useEffect(() => {
        if (!websocket) return;

        const handleMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'MENTAL_HEALTH_SUPPORT_TRIGGER') {
                    setSupportAlert(data);
                }
            } catch (err) {
                console.error('Failed to parse websocket message:', err);
            }
        };

        websocket.addEventListener('message', handleMessage);
        return () => websocket.removeEventListener('message', handleMessage);
    }, [websocket]);

    if (!supportAlert) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-teal-50 border border-teal-200 rounded-lg shadow-lg p-4 flex items-start space-x-3 animate-fade-in">
            <div className="flex-shrink-0 text-teal-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-teal-900">{supportAlert.message}</p>
                <div className="mt-2 flex space-x-3">
                    <a 
                        href={supportAlert.resourceLink} 
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                    >
                        View Walk-In Hours
                    </a>
                    <button 
                        onClick={() => setSupportAlert(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
