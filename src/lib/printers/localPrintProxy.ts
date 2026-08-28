// =============================================================================
// Utility: Local Print Proxy Communication
// Issue: #3223 - Build a 'Smart Name Badge Printer' Integration
// Description: Handles communication between the secure HTTPS React app and
// the insecure local network printer.Browsers block mixed content and
// local IP requests, so this module communicates with a tiny local proxy
// agent(e.g., Go / Python script) running on the Kiosk machine at localhost: 9100.
// =============================================================================

const PROXY_BASE_URL = 'http://127.0.0.1:9100';

export interface PrinterStatus {
    isConnected: boolean;
    model?: string;
    paperLevel?: 'ok' | 'low' | 'empty';
    error?: string;
}

/**
 * Pings the local proxy agent to check if the service is running and 
// if a physical printer is detected and ready.
 */
export async function getPrinterStatus(): Promise<PrinterStatus> {
    try {
        const response = await fetch(`${PROXY_BASE_URL}/status`, {
            method: 'GET',
            // Short timeout to fail fast if the proxy isn't running
            signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
            throw new Error(`Proxy returned status ${response.status}`);
        }

        const data = await response.json();
        return {
            isConnected: data.connected,
            model: data.model,
            paperLevel: data.paper_level || 'ok',
            error: data.error
        };
    } catch (error: any) {
        console.warn('[LocalPrintProxy] Failed to reach local proxy:', error.message);
        return {
            isConnected: false,
            error: 'Local print proxy is offline or unreachable.'
        };
    }
}

/**
 * Sends an SVG payload to the local proxy agent.
 * The proxy is responsible for converting the SVG to a raster image 
// and pushing it to the CUPS printing system or raw USB device.
 */
export async function printSVGLabel(svgContent: string): Promise<boolean> {
    try {
        const response = await fetch(`${PROXY_BASE_URL}/print/svg`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/xml' },
            body: svgContent,
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Print failed: ${errText}`);
        }

        console.log('[LocalPrintProxy] SVG label sent to printer successfully.');
        return true;
    } catch (error: any) {
        console.error('[LocalPrintProxy] Failed to print SVG:', error.message);
        return false;
    }
}

/**
 * Sends raw ZPL commands directly to the proxy, which forwards them 
// to the printer's raw TCP port (usually 9100).
 */
export async function printZPLLabel(zplContent: string): Promise<boolean> {
    try {
        const response = await fetch(`${PROXY_BASE_URL}/print/zpl`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: zplContent,
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Print failed: ${errText}`);
        }

        console.log('[LocalPrintProxy] ZPL label sent to printer successfully.');
        return true;
    } catch (error: any) {
        console.error('[LocalPrintProxy] Failed to print ZPL:', error.message);
        return false;
    }
}
