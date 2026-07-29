import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React from "react";
import { Calendar, MapPin, ExternalLink, CalendarDays } from "lucide-react";

interface EventCardAttributes {
  eventId: string | null;
  title: string | null;
  date?: string | null;
  location?: string | null;
  bannerUrl?: string | null;
  clubName?: string | null;
  url?: string | null;
}

export const EventCardView: React.FC<NodeViewProps> = (props) => {
  const { eventId, title, date, location, bannerUrl, clubName, url } = props.node
    .attrs as EventCardAttributes;

  const eventTitle = title || "Campus Event";
  const eventLink = url || (eventId ? `/events/${eventId}` : "#");

  const formattedDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <NodeViewWrapper className="my-3 block">
      <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 max-w-md border-border/60">
        <div className="flex flex-col sm:flex-row">
          {/* Banner image or fallback placeholder */}
          <div className="sm:w-32 h-24 sm:h-auto relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-background shrink-0">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={eventTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary/40">
                <CalendarDays className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
            <div>
              {clubName && (
                <span className="text-[10px] font-semibold tracking-wide uppercase text-primary/80 block mb-0.5 truncate">
                  {clubName}
                </span>
              )}
              <h4 className="text-sm font-bold leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {eventTitle}
              </h4>

              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {formattedDate && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{formattedDate}</span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Campus Event</span>
              <a
                href={eventLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>View Event</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const EventCardNode = Node.create({
  name: "eventCard",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      eventId: { default: null },
      title: { default: "Campus Event" },
      date: { default: null },
      location: { default: null },
      bannerUrl: { default: null },
      clubName: { default: null },
      url: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="event-card-widget"]',
        getAttrs: (element) => {
          if (typeof element === "string") return false;
          return {
            eventId: element.getAttribute("data-event-id"),
            title: element.getAttribute("data-title"),
            date: element.getAttribute("data-date"),
            location: element.getAttribute("data-location"),
            bannerUrl: element.getAttribute("data-banner-url"),
            clubName: element.getAttribute("data-club-name"),
            url: element.getAttribute("data-url"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        {
          "data-type": "event-card-widget",
          "data-event-id": HTMLAttributes.eventId,
          "data-title": HTMLAttributes.title,
          "data-date": HTMLAttributes.date,
          "data-location": HTMLAttributes.location,
          "data-banner-url": HTMLAttributes.bannerUrl,
          "data-club-name": HTMLAttributes.clubName,
          "data-url": HTMLAttributes.url,
          class: "my-3 block",
        },
        HTMLAttributes,
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EventCardView);
  },
});
