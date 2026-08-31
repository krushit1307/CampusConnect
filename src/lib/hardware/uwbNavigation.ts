import { UWBBeacon, UserPosition, NavigationState, HapticInstruction } from '@/types/uwb';

/**
 * Calculates the Euclidean distance between two 3D points.
 * 
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance in meters
 */
export function calculate3DDistance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates the heading (bearing) from the user's position to the target beacon.
 * 
 * @param userX User's X coordinate
 * @param userY User's Y coordinate
 * @param targetX Target's X coordinate
 * @param targetY Target's Y coordinate
 * @returns Heading in degrees (0-360), where 0 is North (positive Y)
 */
export function calculateHeading(userX: number, userY: number, targetX: number, targetY: number): number {
    const dx = targetX - userX;
    const dy = targetY - userY;

    // Calculate angle in radians and convert to degrees
    let angle = Math.atan2(dx, dy) * (180 / Math.PI);

    // Normalize to 0-360 degrees
    if (angle < 0) {
        angle += 360;
    }

    return angle;
}

/**
 * Determines the appropriate haptic feedback based on the user's heading relative to the target.
 * Assumes the device's "forward" direction is aligned with the user's current movement.
 * 
 * @param headingToTarget Degrees to the target (0-360)
 * @param deviceHeading Degrees the device is currently pointing (0-360)
 * @returns HapticInstruction for the device to execute
 */
export function generateHapticInstruction(headingToTarget: number, deviceHeading: number): HapticInstruction {
    // Calculate the relative angle the user needs to turn
    let relativeAngle = headingToTarget - deviceHeading;

    // Normalize to -180 to 180
    if (relativeAngle > 180) relativeAngle -= 360;
    if (relativeAngle < -180) relativeAngle += 360;

    // Thresholds for haptic feedback
    const STRAIGHT_THRESHOLD = 15; // degrees
    const TURN_THRESHOLD = 45; // degrees

    if (Math.abs(relativeAngle) <= STRAIGHT_THRESHOLD) {
        return {
            pattern: 'continuous',
            duration: 2000,
            description: 'Walk straight ahead',
        };
    } else if (relativeAngle > TURN_THRESHOLD) {
        return {
            pattern: 'pulse_right',
            duration: 1000,
            description: 'Turn right',
        };
    } else if (relativeAngle < -TURN_THRESHOLD) {
        return {
            pattern: 'pulse_left',
            duration: 1000,
            description: 'Turn left',
        };
    } else {
        // Minor adjustment needed
        return {
            pattern: 'pulse_strong',
            duration: 500,
            description: 'Adjust direction slightly',
        };
    }
}

/**
 * Calculates the optimal navigation state for a user in an emergency.
 * 
 * @param userPosition Current user position
 * @param beacons Array of all UWB beacons in the venue
 * @param deviceHeading Current device heading
 * @returns NavigationState with haptic instructions
 */
export function calculateEmergencyNavigation(
    userPosition: UserPosition,
    beacons: UWBBeacon[],
    deviceHeading: number
): NavigationState {
    // Find the nearest exit beacon
    const exitBeacons = beacons.filter(b => b.isExit);

    let nearestExit = exitBeacons[0];
    let minDistance = Infinity;

    for (const beacon of exitBeacons) {
        const distance = calculate3DDistance(userPosition, beacon);
        if (distance < minDistance) {
            minDistance = distance;
            nearestExit = beacon;
        }
    }

    const headingToTarget = calculateHeading(
        userPosition.x,
        userPosition.y,
        nearestExit.x,
        nearestExit.y
    );

    const hapticInstruction = generateHapticInstruction(headingToTarget, deviceHeading);
    const isAtDestination = minDistance < 2.0; // Within 2 meters of exit

    return {
        userPosition,
        targetBeacon: nearestExit,
        distanceToTarget: minDistance,
        headingToTarget,
        hapticInstruction,
        isAtDestination,
    };
}
