import * as React from "react";
import { DayButton, DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
declare function Calendar({ className, classNames, showOutsideDays, captionLayout, buttonVariant, formatters, components, ...props }: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}): React.JSX.Element;
declare function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>): React.JSX.Element;
export { Calendar, CalendarDayButton };
