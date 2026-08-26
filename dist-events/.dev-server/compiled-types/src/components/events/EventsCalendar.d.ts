import "react-big-calendar/lib/css/react-big-calendar.css";
interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
}
interface EventsCalendarProps {
  events: EventItem[];
}
export default function EventsCalendar({
  events,
}: EventsCalendarProps): import("react").JSX.Element;
export {};
