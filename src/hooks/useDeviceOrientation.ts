// =============================================================================
// Hook: useDeviceOrientation
// Issue: #3232 - Build an 'Interactive Venue 360-Tour' Embed
--Description: Manages the DeviceOrientationEvent API to allow users to
--physically move their mobile phones to look around the 360 panorama(AR - lite).
--Handles the strict iOS 13 + permission request flow and provides normalized
--yaw / pitch values for the WebGL camera.
    // =============================================================================

    import { useState, useEffect, useCallback, useRef } from 'react';

export interface OrientationData {
    yaw: number;   // Horizontal rotation (0 to 360)
    pitch: number; // Vertical tilt (-90 to 90)
    roll: number;  // Z-axis rotation (not used for panoramas, but available)
}

interface UseDeviceOrientationReturn {
    orientation: OrientationData | null;
    isSupported: boolean;
    isPermissionGranted: boolean;
    isAbsolute: boolean;
    requestPermission: () => Promise<boolean>;
    isActive: boolean;
    toggleActive: () => void;
}

export function useDeviceOrientation(): UseDeviceOrientationReturn {
    const [orientation, setOrientation] = useState<OrientationData | null>(null);
    const [isSupported, setIsSupported] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState(false);
    const [isAbsolute, setIsAbsolute] = useState(false);
    const [isActive, setIsActive] = useState(false);

    const initialYawRef = useRef<number | null>(null);

    useEffect(() => {
        // Check if the DeviceOrientationEvent is supported
        if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
            setIsSupported(true);

            // Check if permission is already granted (Android/older iOS)
            // iOS 13+ requires explicit user interaction to request permission
            if ((DeviceOrientationEvent as any).requestPermission) {
                setIsPermissionGranted(false); // Must be requested via button click
            } else {
                setIsPermissionGranted(true);
            }
        }
    }, []);

    const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
        // We need alpha (yaw), beta (pitch), gamma (roll)
        let alpha = event.alpha || 0; // Z-axis (compass direction)
        let beta = event.beta || 0;   // X-axis (front/back tilt)
        let gamma = event.gamma || 0; // Y-axis (left/right tilt)

        // Normalize alpha to 0-360
        if (alpha < 0) alpha += 360;

        // For panoramas, we map beta to pitch (-90 to 90)
        // Beta ranges from -180 to 180. We want -90 (down) to 90 (up).
        let pitch = beta;
        if (pitch > 180) pitch -= 360;

        // Clamp pitch to prevent camera flipping over the poles
        pitch = Math.max(-85, Math.min(85, pitch));

        // Calibrate initial yaw so the user's starting position is "forward"
        if (initialYawRef.current === null) {
            initialYawRef.current = alpha;
        }

        let yaw = alpha - initialYawRef.current;
        if (yaw < 0) yaw += 360;
        if (yaw >= 360) yaw -= 360;

        setOrientation({
            yaw,
            pitch,
            roll: gamma
        });

        setIsAbsolute(event.absolute);
    }, []);

    const startListening = useCallback(() => {
        if (isPermissionGranted && isSupported) {
            window.addEventListener('deviceorientation', handleOrientation, true);
            setIsActive(true);
        }
    }, [isPermissionGranted, isSupported, handleOrientation]);

    const stopListening = useCallback(() => {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        setIsActive(false);
        setOrientation(null);
        initialYawRef.current = null;
    }, [handleOrientation]);

    const toggleActive = useCallback(() => {
        if (isActive) {
            stopListening();
        } else {
            startListening();
        }
    }, [isActive, startListening, stopListening]);

    /**
     * Requests permission for iOS 13+ devices.
     * MUST be called from a user interaction event (e.g., onClick).
     */
    const requestPermission = async (): Promise<boolean> => {
        if (!isSupported) return false;

        try {
            const DeviceOrientationEventTyped = DeviceOrientationEvent as any;

            if (typeof DeviceOrientationEventTyped.requestPermission === 'function') {
                const permissionState = await DeviceOrientationEventTyped.requestPermission();

                if (permissionState === 'granted') {
                    setIsPermissionGranted(true);
                    startListening();
                    return true;
                } else {
                    console.warn('[DeviceOrientation] Permission denied by user.');
                    return false;
                }
            } else {
                // Android or older iOS - permission is implicitly granted
                setIsPermissionGranted(true);
                startListening();
                return true;
            }
        } catch (error) {
            console.error('[DeviceOrientation] Failed to request permission:', error);
            return false;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, [stopListening]);

    return {
        orientation,
        isSupported,
        isPermissionGranted,
        isAbsolute,
        requestPermission,
        isActive,
        toggleActive
    };
}
