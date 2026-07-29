type LiveQAProps = {
  eventId: string;
  userId: string | undefined;
  isOrganizer: boolean;
};

export default function LiveQA({ eventId, userId, isOrganizer }: LiveQAProps) {
  // uses useLiveQA(eventId, userId)
  // - shows a highlighted box for the spotlighted question (status === "answering_now")
  // - shows a text input + submit button for attendees to ask a question
  // - shows the queued list, with an "Answer Live" button per question when isOrganizer is true
}