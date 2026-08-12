// src/components/EventForm/LocationInput.tsx
import React from "react";
import { useFormContext } from "react-hook-form";
import { EventFormData } from "../../lib/eventFormSchema";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { cn } from "../../lib/utils";

/**
 * Sub-component for Location input using useFormContext directly to eliminate prop-drilling.
 */
export const LocationInput: React.FC = () => {
  const {
    register,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <div className="space-y-2">
      <Label htmlFor="location">Location</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id="location"
          placeholder="e.g. Student Union, Room 104"
          className={cn("pl-10", errors.location && "border-destructive")}
          {...register("location")}
        />
      </div>
      {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
    </div>
  );
};
