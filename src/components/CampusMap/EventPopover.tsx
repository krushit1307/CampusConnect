// src/components/CampusMap/EventPopover.tsx
import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "../ui/button";
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";

export interface MapEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  attendees: number;
  capacity: number;
  clubName: string;
  clubLogo: string;
  color: string;
}

interface EventPopoverProps {
  event: MapEvent;
  children: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDetails: () => void;
}

/**
 * Radix Popover wrapper for displaying event details when a map pin is clicked.
 * Handles portal rendering, collision detection, and accessible focus management.
 */
export const EventPopover: React.FC<EventPopoverProps> = ({
  event,
  children,
  isOpen,
  onOpenChange,
  onViewDetails,
}) => {
  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-xl bg-popover p-0 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border border-border overflow-hidden"
          sideOffset={10}
          align="center"
          collisionPadding={20}
        >
          {/* Header with color accent */}
          <div className="h-2 w-full" style={{ backgroundColor: event.color }} />

          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                {event.clubLogo ? (
                  <img
                    src={event.clubLogo}
                    alt={event.clubName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold">{event.clubName[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{event.clubName}</p>
                <h3 className="text-base font-bold text-foreground leading-tight truncate">
                  {event.title}
                </h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-foreground/80">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{format(event.date, "MMM d, h:mm a")}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/80">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="truncate">{event.location}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/80 col-span-2">
                <Users className="w-4 h-4 text-primary" />
                <span>
                  {event.attendees} / {event.capacity} attending
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-2">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (event.attendees / event.capacity) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <Button onClick={onViewDetails} className="w-full gap-2" size="sm">
              View Full Details
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
