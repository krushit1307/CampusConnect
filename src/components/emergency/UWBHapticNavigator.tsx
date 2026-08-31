'use client';

import { useState, useEffect, useRef } from 'react';
import { NavigationState, UserPosition } from '@/types/uwb';

interface UWBHapticNavigatorProps {
    isActive: boolean;
    onDeactivate: () => void;
}

export default function UWBHapticNavigator({ isActive, onDeactivate }: UWBHapticNavigatorProps) {
    const [navState, setNavState] = useState<NavigationState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Mock user position and heading (In production, this comes from the device's UWB/IMU sensors)
    const mockUserPosition: UserPosition = { x: 5, y: 5, z: 0, accuracy: 0.5, timestamp: Date.now() };
    const mockDeviceHeading = 45; // Degrees

    useEffect(() => {
        if (!isActive) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Poll for navigation updates every 500ms (simulating real-time UWB tracking)
        intervalRef.current = setInterval(async () => {
            try {
                const response = await fetch('/api/emergency/uwb-routing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userPosition: mockUserPosition,
                        deviceHeading: mockDeviceHeading,
                    }),
                });

                const data = await response.json();
                if (response.ok) {
                    setNavState(data.navigationState);
                    triggerHaptics(data.navigationState.hapticInstruction);
                } else {
                    setError(data.error);
                }
            } catch (err) {
                setError('Failed to fetch navigation data');
            }
        }, 500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isActive]);

    /**
     * Triggers the device's haptic engine based on the navigation instruction.
     * Uses the Web Vibration API for web compatibility.
     */
    const triggerHaptics = (instruction: { pattern: string; duration: number }) => {
        if (!navigator.vibrate) return;

        switch (instruction.pattern) {
            case 'continuous':
                navigator.vibrate(instruction.duration);
                break;
            case 'pulse_left':
                navigator.vibrate([200, 100, 200]);
                break;
            case 'pulse_right':
                navigator.vibrate([300, 100, 300]);
                break;
            case 'pulse_strong':
                navigator.vibrate([500]);
                break;
        }
    };

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white">
            <div className="w-full max-w-md text-center space-y-8">
                <div className="animate-pulse">
                    <svg className="w-24 h-24 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h1 className="text-3xl font-black uppercase tracking-wider">Emergency Evacuation</h1>
                    <p className="text-red-300 mt-2">Follow the haptic vibrations to the nearest exit.</p>
                </div>

                {error ? (
                    <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg">
                        <p className="text-red-200">{error}</p>
                    </div>
                ) : navState ? (
                    <div className="space-y-6">
                        {navState.isAtDestination ? (
                            <div className="p-6 bg-green-900/50 border border-green-700 rounded-xl">
                                <p className="text-2xl font-bold text-green-300">You have reached the exit!</p>
                                <p className="text-green-200 mt-2">Please proceed outside to the assembly area.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
                                    <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">Distance to Exit</p>
                                    <p className="text-5xl font-black text-white">{navState.distanceToTarget.toFixed(1)}m</p>
                                    <p className="text-sm text-gray-400 mt-2">Target: {navState.targetBeacon.name}</p>
                                </div>

                                <div className="p-6 bg-blue-900/30 border border-blue-700 rounded-xl animate-pulse">
                                    <p className="text-sm text-blue-300 uppercase tracking-wider mb-1">Current Direction</p>
                                    <p className="text-2xl font-bold text-white">{navState.hapticInstruction.description}</p>
                                    <p className="text-xs text-blue-400 mt-2">
                                        Device is vibrating: {navState.hapticInstruction.pattern.replace('_', ' ')}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-gray-400">Acquiring UWB signal...</div>
                )}

                <button
                    onClick={onDeactivate}
                    className="w-full py-4 px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                >
                    Deactivate Emergency Mode
                </button>
            </div>
        </div>
    );
}
