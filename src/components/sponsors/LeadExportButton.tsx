// =============================================================================
// Component: LeadExportButton
--Issue: #3238 - Build a 'Sponsorship ROI Dashboard' for Corporate Partners
--Description: A prominent CTA that allows sponsors to download a CSV of
--attendees who explicitly opted -in to share their resume / contact info.
-- =============================================================================

import React, { useState } from 'react';

interface LeadExportButtonProps {
    onExport: () => Promise<boolean>;
    disabled?: boolean;
}

export const LeadExportButton: React.FC<LeadExportButtonProps> = ({ onExport, disabled }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleClick = async () => {
        setIsExporting(true);
        await onExport();
        setIsExporting(false);
    };

    return (
        <button
            onClick={handleClick}
            disabled={isExporting || disabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
        >
            {isExporting ? (
                <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Opt-In Leads (CSV)
                </>
            )}
        </button>
    );
};
