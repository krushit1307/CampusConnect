interface Event {
    id: string;
    title: string;
    description: string | null;
    event_date: string | null;
    start_date?: string | null;
    end_date?: string | null;
    location: string | null;
    banner_url?: string | null;
    created_at?: string | null;
    clubs: {
        name: string;
    } | {
        name: string;
    }[] | null;
    event_rsvps: {
        id: string;
        user_id: string;
    }[] | null;
    saved_events: {
        id: string;
        user_id: string;
    }[] | null;
}
interface EventCardProps {
    event: Event;
    index: number;
    user: {
        id: string;
    } | null;
    onRsvpToggle: (eventId: string, hasRsvpd: boolean) => void;
    isRsvpPending: boolean;
    onBookmarkToggle: (eventId: string, isSaved: boolean) => void;
    isBookmarkPending: boolean;
}
export declare function EventCard({ event, index, user, onRsvpToggle, isRsvpPending, onBookmarkToggle, isBookmarkPending, }: EventCardProps): import("react").JSX.Element;
export {};
