// =============================================================================
// Component: PanoramaViewer
--Issue: #3232 - Build an 'Interactive Venue 360-Tour' Embed
--Description: Integrates Photo Sphere Viewer to render equirectangular 360
--images.Implements progressive loading(blur - up) to prevent mobile freezing,
    --and integrates the DeviceOrientation hook for AR - lite mobile panning.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';
import { PanoramaHotspotManager, Hotspot } from './PanoramaHotspotManager';

// Import Photo Sphere Viewer CSS (Assuming it's bundled or imported globally)
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

interface PanoramaViewerProps {
    venueId: string;
    panoramaUrl: string;
    blurUrl?: string;
    hotspots: Hotspot[];
    onHotspotClick?: (hotspot: Hotspot) => void;
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
    venueId,
    panoramaUrl,
    blurUrl,
    hotspots,
    onHotspotClick
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const {
        orientation,
        isSupported: isGyroSupported,
        isPermissionGranted,
        requestPermission,
        isActive: isGyroActive,
        toggleActive: toggleGyro
    } = useDeviceOrientation();

    // Detect mobile device for UI adjustments
    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Initialize Photo Sphere Viewer
    useEffect(() => {
        if (!containerRef.current) return;

        // Progressive loading: Start with the blurred low-res image
        const initialPanorama = blurUrl || panoramaUrl;

        const viewer = new Viewer({
            container: containerRef.current,
            panorama: initialPanorama,
            loadingImg: blurUrl, // Show blur while high-res loads
            navbar: [
                'zoom',
                'move',
                'download',
                'fullscreen'
            ],
            plugins: [
                [MarkersPlugin, {
                    // Markers will be added dynamically via the HotspotManager
                    clickMarkerOnHover: true,
                }]
            ],
            defaultZoomLvl: 50,
            minFov: 30,
            maxFov: 90,
            touchMoveTwoFingers: true, // Require two fingers to pan on mobile to allow page scrolling
            mousewheelCtrlKey: false,
        });

        viewerRef.current = viewer;

        // Once the blur image is rendered, swap in the high-res image
        if (blurUrl && blurUrl !== panoramaUrl) {
            viewer.addEventListener('ready', () => {
                // Preload high-res image in the background
                const img = new Image();
                img.onload = () => {
                    viewer.setPanorama(panoramaUrl, {
                        transition: true, // Smooth crossfade
                        transitionLoader: true,
                    }).then(() => {
                        setIsLoaded(true);
                    });
                };
                img.src = panoramaUrl;
            });
        } else {
            viewer.addEventListener('ready', () => {
                setIsLoaded(true);
            });
        }

        return () => {
            viewer.destroy();
            viewerRef.current = null;
        };
    }, [panoramaUrl, blurUrl, venueId]);

    // Update camera based on Device Orientation (Gyroscope)
    useEffect(() => {
        if (!viewerRef.current || !orientation || !isGyroActive) return;

        // Map yaw (0-360) to PSV longitude (radians)
        // PSV longitude: 0 is center, increases to the left (negative) and right (positive)
        // We need to convert degrees to radians and adjust for PSV's coordinate system
        const yawRad = (orientation.yaw * Math.PI) / 180;
        const pitchRad = (orientation.pitch * Math.PI) / 180;

        // PSV uses longitude (horizontal) and latitude (vertical)
        // Longitude: 0 to 2PI. Latitude: -PI/2 to PI/2
        viewerRef.current.rotate({
            longitude: yawRad,
            latitude: pitchRad
        });
    }, [orientation, isGyroActive]);

    const handleGyroToggle = async () => {
        if (!isPermissionGranted) {
            // Request permission on first click (Required for iOS 13+)
            await requestPermission();
        } else {
            toggleGyro();
        }
    };

    return (
        <div className="relative w-full h-[400px] md:h-[600px] bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
            {/* WebGL Container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Loading Overlay */}
            {!isLoaded && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <svg className="animate-spin h-10 w-10" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="font-medium">Loading 360° Tour...</p>
                    </div>
                </div>
            )}

            {/* Hotspot Manager (Renders markers into the PSV instance) */}
            {viewerRef.current && (
                <PanoramaHotspotManager
                    viewer={viewerRef.current}
                    hotspots={hotspots}
                    onHotspotClick={onHotspotClick}
                />
            )}

            {/* Gyroscope Toggle Button (Mobile Only) */}
            {isMobile && isGyroSupported && (
                <button
                    onClick={handleGyroToggle}
                    className={`absolute bottom-4 right-4 z-20 p-3 rounded-full shadow-lg transition-all ${isGyroActive
                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-400/50'
                            : 'bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-white hover:bg-white'
                        }`}
                    title={isGyroActive ? 'Disable Gyroscope' : 'Enable Gyroscope (Look around)'}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                </button>
            )}

            {/* Interaction Hint */}
            {isLoaded && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none animate-fade-out">
                    {isMobile ? 'Drag with two fingers to look around' : 'Click and drag to look around'}
                </div>
            )}

            <style>{`
        @keyframes fade-out {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-fade-out {
          animation: fade-out 4s ease-in-out forwards;
        }
      `}</style>
        </div>
    );
};
