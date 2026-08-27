// =============================================================================
// Utility: Event Accessibility & Temporal Logic
// Issue: #3324 - Implement 'Automated Dorm vs Commuter Demographic Tagging'
// Description: Contains pure functions to evaluate event times against typical
// public transit schedules to determine commuter accessibility.
// =============================================================================

export type AccessibilityTag = 'commuter-friendly' | 'dorm-only' | 'late-night';

/**
 * Evaluates the end time of an event to determine if it alienates commuters.
 * Most campus commuter trains/buses stop running between 9:00 PM and 10:00 PM.
 * 
 * @param endTimeStr - ISO string or HH:mm format of the event end time
 * @returns Object containing the risk level and suggested tags
 */
export function evaluateCommuterAccessibility(endTimeStr: string): {
    isLate: boolean;
    riskLevel: 'none' | 'moderate' | 'high';
    suggestedTags: AccessibilityTag[];
    warningMessage: string | null;
} {
    // Parse the end time to extract hours and minutes
    const date = new Date(endTimeStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Thresholds (in 24-hour time)
    const SAFE_THRESHOLD = 20 * 60; // 8:00 PM
    const WARNING_THRESHOLD = 21 * 60; // 9:00 PM
    const DANGER_THRESHOLD = 22 * 60; // 10:00 PM

    const tags: AccessibilityTag[] = [];
    let riskLevel: 'none' | 'moderate' | 'high' = 'none';
    let warningMessage: string | null = null;

    if (totalMinutes >= DANGER_THRESHOLD) {
        // Past 10 PM: Extremely high risk for commuters
        riskLevel = 'high';
        tags.push('dorm-only', 'late-night');
        warningMessage = 'This event ends very late. Most public transit has stopped. Commuter students will likely be unable to attend safely.';
    } else if (totalMinutes >= WARNING_THRESHOLD) {
        // Past 9 PM: Moderate risk
        riskLevel = 'moderate';
        tags.push('late-night');
        warningMessage = 'This event ends late. Many commuter train lines reduce frequency or stop after 9 PM.';
    } else if (totalMinutes <= SAFE_THRESHOLD) {
        // Before 8 PM: Very safe
        tags.push('commuter-friendly');
    }

    return {
        isLate: totalMinutes >= WARNING_THRESHOLD,
        riskLevel,
        suggestedTags: tags,
        warningMessage
    };
}

/**
 * Formats the warning message to include the specific club commuter percentage.
 */
export function formatCommuterWarning(baseMessage: string, commuterPercentage: number): string {
    if (commuterPercentage <= 0) return baseMessage;

    return `${baseMessage} Note: ${commuterPercentage}% of your club members are Commuters and may miss the last train. Consider ending by 8 PM.`;
}
