import { ReactNode } from "react";
import { useEventCardContext } from "./EventCardContext";

export function EventCardContentContainer({ children }: { children?: ReactNode }) {
  const { event, cardBg } = useEventCardContext();

  return (
    <article id={`event-${event.id}`} className={`neu-border p-5 relative ${cardBg}`}>
      {children}
    </article>
  );
}
