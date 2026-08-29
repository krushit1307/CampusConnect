/**
 * Gamification Types for CampusConnect
 * Defines interfaces and types related to points, streaks, and event series.
 */

export interface EventSeries {
    id: string;
    name: string;
    description: string;
    total_events: number;
    created_at: string;
    updated_at: string;
}

export interface UserEventAttendance {
    user_id: string;
    event_id: string;
    event_series_id: string | null;
    check_in_timestamp: string;
    points_awarded: number;
    streak_multiplier: number;
    consecutive_attendance_count: number;
    status: 'attended' | 'no_show' | 'excused';
}

export interface GamificationReward {
    id: string;
    user_id: string;
    event_id: string;
    base_points: number;
    multiplier_applied: number;
    final_points: number;
    streak_message: string;
    created_at: string;
}

export interface CheckInResponse {
    success: boolean;
    message: string;
    points_awarded: number;
    streak_count: number;
    multiplier: number;
    is_series_event: boolean;
    series_name?: string;
}

export interface StreakData {
    current_streak: number;
    max_streak: number;
    next_multiplier: number;
}
