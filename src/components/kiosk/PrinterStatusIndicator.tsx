// =============================================================================
// Component: PrinterStatusIndicator
// Issue: #3223 - Build a 'Smart Name Badge Printer' Integration
// Description: A small UI widget displayed in the Kiosk header to show the
// real - time connection status of the local label printer.Alerts the
// attendant if paper is low or the proxy is offline.
// =============================================================================

import React from 'react';
import { PrinterStatus } from '../../lib/printers/localPrintProxy';

interface PrinterStatusIndicatorProps {
    status: PrinterStatus;
    isPrinting: boolean;
}

export const PrinterStatusIndicator: React.FC<PrinterStatusIndicatorProps> = ({ status, isPrinting }) => {

    const getStatusConfig = () => {
        if (isPrinting) {
            return {
                color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
                icon: (
                    <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                ),
                text: 'Printing...'
            };
        }

        if (!status.isConnected) {
            return {
                color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                ),
                text: 'Printer Offline'
            };
        }

        if (status.paperLevel === 'empty') {
            return {
                color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                ),
                text: 'Paper Empty'
            };
        }

        if (status.paperLevel === 'low') {
            return {
                color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
                icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
                text: 'Paper Low'
            };
        }

        return {
            color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            ),
            text: 'Printer Ready'
        };
    };

    const config = getStatusConfig();

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${config.color}`}>
            {config.icon}
            <span>{config.text}</span>
            {status.model && status.isConnected && !isPrinting && (
                <span className="text-gray-500 dark:text-gray-400 font-normal hidden sm:inline">
                    ({status.model})
                </span>
            )}
        </div>
    );
};
