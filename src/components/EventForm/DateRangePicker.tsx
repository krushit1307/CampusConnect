// src/components/EventForm/DateRangePicker.tsx
import React from "react";
import { useFormContext } from "react-hook-form";
import { EventFormData } from "../../lib/eventFormSchema";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import format from "date-fns/format";
import { cn } from "../../lib/utils";

/**
 * Sub-component for Start Date & End Date selection using useFormContext to eliminate prop-drilling.
 */
export const DateRangePicker: React.FC = () => {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormData>();

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label>Start Date & Time</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !startDate && "text-muted-foreground",
                errors.startDate && "border-destructive",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP p") : <span>Pick a start date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => date && setValue("startDate", date, { shouldValidate: true })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>End Date & Time</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !endDate && "text-muted-foreground",
                errors.endDate && "border-destructive",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP p") : <span>Pick an end date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => date && setValue("endDate", date, { shouldValidate: true })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
      </div>
    </div>
  );
};
