// =============================================================================
// Component: PanoramaHotspotManager
--Issue: #3232 - Build an 'Interactive Venue 360-Tour' Embed
--Description: Manages the rendering of interactive 3D "Hotspots"(information 
--icons) within the Photo Sphere Viewer.Allows venue managers to place
--markers over specific features(e.g., power outlets, AV equipment) that
--display tooltips when clicked.
    // =============================================================================

    import { useEffect, useRef } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';

export interface Hotspot {
    id: string;
    yaw: number;   // Horizontal angle in degrees (-180 to 180)
    pitch: number; // Vertical angle in degrees (-90 to 90)
    icon: 'power' | 'av' | 'info' | 'warning' | 'exit';
    title: string;
    description: string;
}

interface PanoramaHotspotManagerProps {
    viewer: Viewer;
    hotspots: Hotspot[];
    onHotspotClick?: (hotspot: Hotspot) => void;
}

// Map icon types to SVG data URIs for the markers
const ICON_MAP: Record<Hotspot['icon'], string> = {
    power: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23EF4444" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`,
    av: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233B82F6" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`,
    info: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310B981" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23F59E0B" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
    exit: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236B7280" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>`
};

export const PanoramaHotspotManager: React.FC<PanoramaHotspotManagerProps> = ({
    viewer,
    hotspots,
    onHotspotClick
}) => {
    const markersPluginRef = useRef<MarkersPlugin | null>(null);

    useEffect(() => {
        // Get the MarkersPlugin instance from the viewer
        const plugin = viewer.getPlugin(MarkersPlugin);
        if (!plugin) return;

        markersPluginRef.current = plugin;

        // Convert our Hotspot interface to PSV Marker properties
        const markers = hotspots.map(hotspot => ({
            id: hotspot.id,
            longitude: `${hotspot.yaw}deg`,
            latitude: `${hotspot.pitch}deg`,
            image: ICON_MAP[hotspot.icon] || ICON_MAP.info,
            width: 40,
            height: 40,
            anchor: 'center center',
            tooltip: {
                content: `
          <div style="max-width: 200px; padding: 4px;">
            <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${hotspot.title}</strong>
            <span style="font-size: 12px; color: #666;">${hotspot.description}</span>
          </div>
        `,
                position: 'top right',
            },
            data: { hotspot } // Attach original data for click events
        }));

        // Clear existing markers and set new ones
        plugin.clearMarkers();
        plugin.setMarkers(markers);

        // Listen for marker clicks
        const handleClick = (e: any) => {
            const marker = e.marker;
            if (marker && marker.data && marker.data.hotspot) {
                onHotspotClick?.(marker.data.hotspot);
            }
        };

        plugin.addEventListener('select-marker', handleClick);

        return () => {
            plugin.removeEventListener('select-marker', handleClick);
            plugin.clearMarkers();
        };
    }, [viewer, hotspots, onHotspotClick]);

    // This component doesn't render any DOM itself; it purely manages the PSV plugin
    return null;
};
