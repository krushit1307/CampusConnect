import React from "react";
import { User } from "@supabase/supabase-js";
interface EventFeedbackFormProps {
  eventId: string;
  user: User | null;
}
export declare function EventFeedbackForm({
  eventId,
  user,
}: EventFeedbackFormProps): React.JSX.Element;
export {};
