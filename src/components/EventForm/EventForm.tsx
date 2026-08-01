// src/components/EventForm/EventForm.tsx
import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormSchema, EventFormData } from "../../lib/eventFormSchema";
import { TicketTiers } from "./TicketTiers";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../ui/card";
import { CalendarIcon, MapPin, Save, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

interface EventFormProps {
  onSubmit: (data: EventFormData) => Promise<void>;
  defaultValues?: Partial<EventFormData>;
}

/**
 * Master Event Creation / Edit Form.
 * Uses `react-hook-form` and `zod` for robust validation.
 * Contains the dynamic `TicketTiers` array as a nested field array.
 */
export const EventForm: React.FC<EventFormProps> = ({ onSubmit, defaultValues }) => {
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      tickets: [],
      ...defaultValues,
    },
    mode: "onChange",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form;

  const handleFormSubmit = async (data: EventFormData) => {
    try {
      await onSubmit(data);
      toast.success("Event saved successfully!");
    } catch (error) {
      toast.error("Failed to save event. Please try again.");
    }
  };

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Event Details</CardTitle>
            <CardDescription>Provide the core information for your event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              {errors.location && (
                <p className="text-xs text-destructive">{errors.location.message}</p>
              )}
            </div>

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
                      {startDate ? format(startDate, "PPP p") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) =>
                        date && setValue("startDate", date, { shouldValidate: true })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
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
                      {endDate ? format(endDate, "PPP p") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) =>
                        date && setValue("endDate", date, { shouldValidate: true })
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Ticket Tiers Section */}
        <TicketTiers form={form} />

        <Card>
          <CardFooter className="flex justify-end gap-3 pt-6">
            <Button type="button" variant="outline">
              Cancel
            </Button>
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
