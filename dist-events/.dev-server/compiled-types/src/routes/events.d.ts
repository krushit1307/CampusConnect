export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  created_at?: string | null;
  clubs:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  event_rsvps:
    | {
        id: string;
        user_id: string;
      }[]
    | null;
  saved_events:
    | {
        id: string;
        user_id: string;
      }[]
    | null;
}
export default function EventsPage(): import("react").JSX.Element;
