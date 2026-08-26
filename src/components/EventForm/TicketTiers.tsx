// src/components/EventForm/TicketTiers.tsx
import React from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { EventFormData, TicketTier } from "../../lib/eventFormSchema";
import { TicketTierItem } from "./TicketTierItem";
import { Button } from "../ui/button";
import { useTicketCalculations } from "../../hooks/useTicketCalculations";
import PlusCircle from "lucide-react/dist/esm/icons/plus-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Layers from "lucide-react/dist/esm/icons/layers";
import { Alert, AlertDescription } from "../ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface TicketTiersProps {
  className?: string;
}

/**
 * Manages the dynamic array of ticket tiers using react-hook-form's `useFieldArray` & `useFormContext`.
 * Eliminates prop-drilling by retrieving form context directly.
 * Integrates with `@hello-pangea/dnd` for drag-and-drop reordering.
 */
export const TicketTiers: React.FC<TicketTiersProps> = ({ className }) => {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<EventFormData>();

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "tickets",
  });

  // Watch current tiers for calculations
  const ticketsWatch = watch("tickets");
  const currentTiers: TicketTier[] = Array.isArray(ticketsWatch) ? ticketsWatch : [];
  const calculations = useTicketCalculations(currentTiers);

  const handleAddTier = () => {
    append({
      name: "",
      price: 0,
      capacity: 100,
      description: "",
      isEarlyBird: false,
      isActive: true,
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    move(result.source.index, result.destination.index);
  };

  const arrayError = typeof errors.tickets?.message === "string" ? errors.tickets.message : null;

  return (
    <div className={className || "space-y-6"}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Ticket Tiers & Pricing
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define the different ticket options available for this event. Drag to reorder how they
            appear to users.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {arrayError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{arrayError}</AlertDescription>
            </Alert>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="ticket-tiers">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {fields.map((field, index) => (
                    <Draggable key={field.id} draggableId={field.id} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps}>
                          <TicketTierItem
                            index={index}
                            onRemove={remove}
                            isDragging={snapshot.isDragging}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed h-12 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            onClick={handleAddTier}
            disabled={fields.length >= 20}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Ticket Tier
          </Button>
        </CardContent>
      </Card>

      {/* Real-time Projections Summary */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue Projections
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{calculations.activeTiersCount}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Tiers</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{calculations.totalCapacity}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Total Capacity
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-primary">
                ${calculations.maxPotentialRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Max Revenue</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">
                ${calculations.averageTicketPrice.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Price</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
