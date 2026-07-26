import { EventCardProps, EventCardProvider } from "./EventCardContext";
import { EventCardContentContainer } from "./EventCardContentContainer";
import { EventCardHeader } from "./EventCardHeader";
import { EventCardBody } from "./EventCardBody";
import { EventCardActions } from "./EventCardActions";
import { EventCardProgressBar } from "./EventCardProgressBar";
import { EventCardDetails } from "./EventCardDetails";

export function EventCard(props: EventCardProps) {
  const { children, ...providerProps } = props;

  return (
    <EventCardProvider {...providerProps}>
      <EventCardContentContainer>
        {children ? (
          children
        ) : (
          <>
            <EventCardHeader />
            <EventCardBody />
            <EventCardActions />
          </>
        )}
      </EventCardContentContainer>
    </EventCardProvider>
  );
}

EventCard.Header = EventCardHeader;
EventCard.Body = EventCardBody;
EventCard.Actions = EventCardActions;
EventCard.ProgressBar = EventCardProgressBar;
EventCard.Details = EventCardDetails;
