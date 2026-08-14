// =============================================================================
// Hook: useKioskPrinter
// Issue: #3223 - Build a 'Smart Name Badge Printer' Integration
// Description: Manages the printer connection state, monitors paper levels,
// and exposes a simple `printBadge` function that generates the payload and
// sends it to the local proxy.Includes a polling mechanism for status updates.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getPrinterStatus,
    printSVGLabel,
    printZPLLabel,
    PrinterStatus
} from '../../lib/printers/localPrintProxy';
import { generateBadgeSVG, generateBadgeZPL, BadgeData } from '../../lib/printers/labelRenderer';

interface UseKioskPrinterReturn {
    status: PrinterStatus;
    isPrinting: boolean;
    printBadge: (data: BadgeData, format: 'svg' | 'zpl') => Promise<boolean>;
    refreshStatus: () => Promise<void>;
}

export function useKioskPrinter(): UseKioskPrinterReturn {
    const [status, setStatus] = useState<PrinterStatus>({ isConnected: false });
    const [isPrinting, setIsPrinting] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const refreshStatus = useCallback(async () => {
        const newStatus = await getPrinterStatus();
        setStatus(newStatus);
    }, []);

    // Poll printer status every 10 seconds to detect paper jams or disconnections
    useEffect(() => {
        refreshStatus();

        pollingRef.current = setInterval(() => {
            refreshStatus();
        }, 10000);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [refreshStatus]);

    const printBadge = async (data: BadgeData, format: 'svg' | 'zpl' = 'svg'): Promise<boolean> => {
        if (!status.isConnected) {
            console.error('[useKioskPrinter] Cannot print: Printer is disconnected.');
            return false;
        }

        if (status.paperLevel === 'empty') {
            console.error('[useKioskPrinter] Cannot print: Paper is empty.');
            return false;
        }

        setIsPrinting(true);
        let success = false;

        try {
            if (format === 'zpl') {
                const zpl = generateBadgeZPL(data);
                success = await printZPLLabel(zpl);
            } else {
                const svg = generateBadgeSVG(data);
                success = await printSVGLabel(svg);
            }

            // Refresh status immediately after printing to check for new errors
            await refreshStatus();
        } catch (err) {
            console.error('[useKioskPrinter] Print job failed:', err);
            success = false;
        } finally {
            setIsPrinting(false);
        }

        return success;
    };

    return {
        status,
        isPrinting,
        printBadge,
        refreshStatus
    };
}
