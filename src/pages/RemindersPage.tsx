import { Helmet } from "react-helmet-async";
import { ReminderBoard } from "@/components/reminders/ReminderBoard";

export default function RemindersPage() {
  return (
    <>
      <Helmet>
        <title>Event Reminders | CampusConnect</title>
        <meta name="description" content="Set smart reminders for campus events. Never miss a meeting, workshop, or social again." />
        <meta property="og:title" content="Event Reminders | CampusConnect" />
      </Helmet>
      <ReminderBoard />
    </>
  );
}
