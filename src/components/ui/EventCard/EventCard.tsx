import { memo } from "react";
import { EventCardProps, EventCardProvider } from "./EventCardContext";
import { EventCardContentContainer } from "./EventCardContentContainer";
import { EventCardHeader } from "./EventCardHeader";
import { EventCardBody } from "./EventCardBody";
import { EventCardActions } from "./EventCardActions";
import { EventCardProgressBar } from "./EventCardProgressBar";
import { EventCardDetails } from "./EventCardDetails";

const EventCardComponent = memo(function EventCard(props: EventCardProps) {
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
});

export const EventCard = Object.assign(EventCardComponent, {
  Header: EventCardHeader,
  Body: EventCardBody,
  Actions: EventCardActions,
  ProgressBar: EventCardProgressBar,
  Details: EventCardDetails,
});
