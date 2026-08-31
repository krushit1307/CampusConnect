/**
 * Ultra-Wideband (UWB) and Haptic Navigation Types for CampusConnect
 * Defines interfaces for indoor positioning, beacon data, and haptic feedback vectors.
 */

/**
 * Represents a physical UWB beacon installed in a venue.
 */
export interface UWBBeacon {
    /** Unique identifier for the beacon */
    id: string;
    /** Human-readable location name */
    name: string;
    /** X coordinate in the venue's local coordinate system (meters) */
    x: number;
    /** Y coordinate in the venue's local coordinate system (meters) */
    y: number;
    /** Z coordinate (floor level) */
    z: number;
    /** Whether the beacon is an emergency exit */
    isExit: boolean;
}

/**
 * Represents the user's calculated position via UWB trilateration.
 */
export interface UserPosition {
    /** X coordinate in meters */
    x: number;
    /** Y coordinate in meters */
    /** Z coordinate in meters */
    z: number;
    /** Accuracy radius in meters */
    accuracy: number;
    /** Timestamp of the position fix */
    timestamp: number;
}

/**
 * Haptic feedback instruction for the user's device.
 */
export interface HapticInstruction {
    /** Type of haptic pattern */
    pattern: 'continuous' | 'pulse_left' | 'pulse_right' | 'pulse_strong';
    /** Duration of the vibration in milliseconds */
    duration: number;
    /** Text description for accessibility screen readers */
    description: string;
}

/**
 * Navigation state for guiding the user to an exit.
 */
export interface NavigationState {
    userPosition: UserPosition;
    targetBeacon: UWBBeacon;
    distanceToTarget: number;
    headingToTarget: number; // Degrees (0-360)
    hapticInstruction: HapticInstruction;
    isAtDestination: boolean;
}
