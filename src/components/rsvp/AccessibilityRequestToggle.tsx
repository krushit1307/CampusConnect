// =============================================================================
// Component: AccessibilityRequestToggle
//  Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
//  Description: Integrated into the RSVP checkout flow. Presents a checkbox for
//  users to request ASL interpreters or captioning devices. If checked, reveals
//  a text input for additional notes and triggers the automated email alert.
// =============================================================================

import React, { useState } from 'react';
import { useAccessibilityRequests, AccessibilityType } from '../../hooks/useAccessibilityRequests';

interface AccessibilityRequestToggleProps {
    rsvpId: string;
    eventId: string;
    onRequestSubmitted: () => void;
}

export const AccessibilityRequestToggle: React.FC<AccessibilityRequestToggleProps> = ({
    rsvpId,
    eventId,
    onRequestSubmitted
}) => {
    const { isSubmitting, error, submitRequest } = useAccessibilityRequests();
    const [isChecked, setIsChecked] = useState(false);
    const [requestType, setRequestType] = useState<AccessibilityType>('asl_interpreter');
    const [notes, setNotes] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsChecked(checked);
        setIsExpanded(checked);
    };

    const handleSubmit = async () => {
        const success = await submitRequest(rsvpId, eventId, requestType, notes);
        if (success) {
            onRequestSubmitted();
            setIsExpanded(false); // Collapse after successful submission
        }
    };

    return (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleCheckboxChange}
                    className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div className="flex-1">
                    <span className="font-bold text-gray-900 dark:text-white text-sm">
                        I require accessibility accommodations
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Request an ASL Interpreter, Captioning Device, or other support. The University Disability Center will be notified instantly.
                    </p>
                </div>
            </label>

            {isExpanded && (
                <div className="pl-8 space-y-3 animate-slide-down">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Type of Accommodation
                        </label>
                        <select
                            value={requestType}
                            onChange={(e) => setRequestType(e.target.value as AccessibilityType)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="asl_interpreter">ASL Interpreter</option>
                            <option value="captioning_device">Captioning Device / CART</option>
                            <option value="wheelchair_access">Wheelchair Accessibility Check</option>
                            <option value="other">Other (Please specify below)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Additional Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g., Prefer interpreter to be on the left side of the stage..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-bold shadow-sm"
                    >
                        {isSubmitting ? 'Submitting Request...' : 'Submit Accessibility Request'}
                    </button>
                </div>
            )}

            <style>{`
        @keyframes slide-down {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
          overflow: hidden;
        }
      `}</style>
        </div>
    );
};
