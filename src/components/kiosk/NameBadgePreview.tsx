// =============================================================================
// Component: NameBadgePreview
// Issue: #3223 - Build a 'Smart Name Badge Printer' Integration
// Description: Renders a visual, scaled - down preview of the name badge SVG
// directly in the browser.Useful for the Kiosk admin interface to verify
// layout and text wrapping before sending to the physical printer.
// =============================================================================

import React, { useMemo } from 'react';
import { generateBadgeSVG, BadgeData } from '../../lib/printers/labelRenderer';

interface NameBadgePreviewProps {
    data: BadgeData;
    width?: number;
}

export const NameBadgePreview: React.FC<NameBadgePreviewProps> = ({ data, width = 200 }) => {
    // Memoize the SVG generation to prevent unnecessary recalculations on re-renders
    const svgContent = useMemo(() => {
        if (!data.firstName && !data.lastName) return '';
        return generateBadgeSVG(data);
    }, [data]);

    if (!svgContent) {
        return (
            <div
                className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
                style={{ width: `${width}px`, height: `${width * 1.5}px` }}
            >
                No Data
            </div>
        );
    }

    // The SVG has a fixed viewBox, so we can scale it safely via CSS width/height
    return (
        <div
            className="shadow-lg rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white"
            style={{ width: `${width}px`, height: `${width * 1.5}px` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
};
