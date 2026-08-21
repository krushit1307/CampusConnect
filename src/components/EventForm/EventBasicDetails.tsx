// src/components/EventForm/EventBasicDetails.tsx
import React from "react";
import { useFormContext } from "react-hook-form";
import { EventFormData } from "../../lib/eventFormSchema";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

/**
 * Sub-component for Event Title & Description using useFormContext to prevent prop-drilling.
 */
export const EventBasicDetails: React.FC = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          placeholder="e.g. Annual Tech Hackathon"
          {...register("title")}
          className={cn(errors.title && "border-destructive")}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe what attendees will experience..."
          rows={4}
          {...register("description")}
          className={cn(errors.description && "border-destructive")}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>
    </div>
  );
};
