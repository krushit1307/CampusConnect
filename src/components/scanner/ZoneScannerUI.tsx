// =============================================================================
// Component: ZoneScannerUI
// Issue: #4047 - Develop a 'Dynamic "VIP/Sponsor" Access Control'
// Description: The main scanner interface for organizers. Allows selection of 
// the current scanning zone and displays the AccessResultModal upon scan.
// =============================================================================

import React, { useState } from 'react';
import { useZoneScanner } from '../../hooks/useZoneScanner';
import { AccessResultModal } from './AccessResultModal';

interface ZoneScannerUIProps {
    eventId: string;
    onScan: (ticketId: string) => void; // Mock camera scan callback
}

export const ZoneScannerUI: React.FC<ZoneScannerUIProps> = ({ eventId, onScan }) => {
    const {
        selectedZoneId, zones, isLoadingZones, isVerifying, result, error,
        setSelectedZone, verifyTicket, clearResult
    } = useZoneScanner(eventId);

    const [lastScannedId, setLastScannedId] = useState<string | null>(null);

    const handleScan = (ticketId: string) => {
        setLastScannedId(ticketId);
        verifyTicket(ticketId);
    };

    // Mock trigger for demonstration (replace with actual camera library)
    const triggerMockScan = () => {
        handleScan('mock-ticket-uuid-12345');
    };

    return (
        <div className="max-w-md mx-auto p-4 space-y-6">
            {/* Zone Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Current Scanning Zone
                </label>
                {isLoadingZones ? (
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                ) : (
                    <select
                        value={selectedZoneId || ''}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                        {zones.map(zone => (
                            <option key={zone.id} value={zone.id}>
                                {zone.name} (Min: {zone.min_required_tier.toUpperCase()})
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Scanner Viewport Mock */}
            <div className="relative aspect-square bg-black rounded-2xl overflow-hidden border-4 border-gray-800 shadow-2xl flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-dashed border-white/30 m-8 rounded-lg" />
                <div className="text-center text-white/50">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="font-medium">Camera Viewport</p>
                </div>

                {/* Mock Scan Button */}
                <button
                    onClick={triggerMockScan}
                    disabled={isVerifying}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isVerifying ? 'Verifying...' : 'Simulate Scan'}
                </button>
      isVerifying ? 'Verifying...' : 'Simulate Scan'}
            </button>
        </div>

      {
        error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm text-center">
                {error}
            </div>
        )
    }

    {/* Result Modal */ }
    {
        result && lastScannedId && (
            <AccessResultModal
                result={result}
                onDismiss={() => { clearResult(); setLastScannedId(null); }}
            />
        )
    }
    </div >
  );
};
