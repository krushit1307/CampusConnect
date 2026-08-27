// src/components/EventForm/EventForm.tsx
import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormSchema, EventFormData } from "../../lib/eventFormSchema";
import { EventBasicDetails } from "./EventBasicDetails";
import { LocationInput } from "./LocationInput";
import { DateRangePicker } from "./DateRangePicker";
import { TicketTiers } from "./TicketTiers";
import { EventTagInput } from "./EventTagInput"; // <-- NEW IMPORT
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../ui/card";
import Save from "lucide-react/dist/esm/icons/save";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from "sonner";

interface EventFormProps {
  onSubmit: (data: EventFormData) => Promise<void>;
  defaultValues?: Partial<EventFormData>;
  onCancel?: () => void;
}

/**
 * Master Event Creation / Edit Form.
 * Uses `react-hook-form` `FormProvider` and `useFormContext` to decouple sub-components
 * from deep prop-drilling hierarchy.
 */
export const EventForm: React.FC<EventFormProps> = ({ onSubmit, defaultValues, onCancel }) => {
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      tickets: [],
      tags: [], // <-- Initialize tags array
      ...defaultValues,
    },
    mode: "onChange",
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const handleFormSubmit = async (data: EventFormData) => {
    try {
      await onSubmit(data);
      toast.success("Event saved successfully!");
    } catch (error) {
      toast.error("Failed to save event. Please try again.");
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Event Details</CardTitle>
            <CardDescription>Provide the core information for your event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <EventBasicDetails />
            <EventTagInput /> {/* <-- INJECTED TAG INTERCEPTOR */}
            <LocationInput />
            <DateRangePicker />
          </CardContent>
        </Card>

        {/* Dynamic Ticket Tiers Section — Context-driven without prop-drilling */}
        <TicketTiers />

        <Card>
          <CardFooter className="flex justify-end gap-3 pt-6">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Event
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </FormProvider>
  );
};
