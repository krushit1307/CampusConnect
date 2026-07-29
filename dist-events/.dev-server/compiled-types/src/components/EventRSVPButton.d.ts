interface EventRSVPButtonProps {
    eventId: string;
    user: {
        id: string;
    } | null;
    hasRsvpd: boolean;
    isPending: boolean;
    onToggle: (eventId: string, hasRsvpd: boolean) => void;
}
export declare function EventRSVPButton({ eventId, user, hasRsvpd, isPending, onToggle, }: EventRSVPButtonProps): import("react").JSX.Element;
export {};
