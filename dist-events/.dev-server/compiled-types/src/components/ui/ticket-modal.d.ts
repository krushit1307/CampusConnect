interface Event {
  id: string;
  title: string;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}
interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  rsvpId: string;
}
export declare function TicketDialog({
  open,
  onOpenChange,
  event,
  rsvpId,
}: TicketDialogProps): import("react").JSX.Element;
export {};
