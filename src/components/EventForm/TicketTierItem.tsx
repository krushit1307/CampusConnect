// src/components/EventForm/TicketTierItem.tsx
import React from "react";
import { useFormContext } from "react-hook-form";
import { EventFormData } from "../../lib/eventFormSchema";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Users from "lucide-react/dist/esm/icons/users";
import Tag from "lucide-react/dist/esm/icons/tag";
import { cn } from "../../lib/utils";

interface TicketTierItemProps {
  index: number;
  onRemove: (index: number) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

/**
 * Represents a single row in the dynamic ticket tiers array.
 * Uses `useFormContext()` directly to access registration, state, and error handling without prop-drilling.
 */
export const TicketTierItem: React.FC<TicketTierItemProps> = ({
  index,
  onRemove,
  isDragging,
  dragHandleProps,
}) => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormData>();

  const tier = watch(`tickets.${index}`) || {
    name: "",
    price: 0,
    capacity: 100,
    description: "",
    isEarlyBird: false,
    isActive: true,
  };

  const tierErrors = errors.tickets?.[index] as Record<string, { message?: string }> | undefined;

  return (
    <div
      className={cn(
        "relative p-4 border rounded-xl bg-card shadow-sm transition-all",
        isDragging && "shadow-xl ring-2 ring-primary opacity-90 scale-[1.02]",
        !tier.isActive && "opacity-50 bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          {...dragHandleProps}
          className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Drag to reorder tier"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Tag className="w-3.5 h-3.5" /> Tier Name
            </Label>
            <Input
              placeholder="e.g. Early Bird, General Admission"
              {...register(`tickets.${index}.name` as const)}
              className={cn(
                tierErrors?.name && "border-destructive focus-visible:ring-destructive",
              )}
            />
            {tierErrors?.name && (
              <p className="text-xs text-destructive">{tierErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <DollarSign className="w-3.5 h-3.5" /> Price
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              {...register(`tickets.${index}.price` as const, { valueAsNumber: true })}
              className={cn(
                tierErrors?.price && "border-destructive focus-visible:ring-destructive",
              )}
            />
            {tierErrors?.price && (
              <p className="text-xs text-destructive">{tierErrors.price.message}</p>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => onRemove(index)}
          aria-label="Remove ticket tier"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 pl-8">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium">
            <Users className="w-3.5 h-3.5" /> Capacity
          </Label>
          <Input
            type="number"
            min="1"
            placeholder="100"
            {...register(`tickets.${index}.capacity` as const, { valueAsNumber: true })}
            className={cn(
              tierErrors?.capacity && "border-destructive focus-visible:ring-destructive",
            )}
          />
          {tierErrors?.capacity && (
            <p className="text-xs text-destructive">{tierErrors.capacity.message}</p>
          )}
        </div>

        <div className="flex items-center gap-3 sm:col-span-2 pt-5">
          <Switch
            id={`early-bird-${index}`}
            checked={Boolean(tier.isEarlyBird)}
            onCheckedChange={(checked) => {
              setValue(`tickets.${index}.isEarlyBird`, checked, { shouldValidate: true });
            }}
          />
          <Label htmlFor={`early-bird-${index}`} className="text-sm cursor-pointer">
            Early Bird Pricing
          </Label>
        </div>
      </div>

      <div className="pl-8">
        <Label className="text-xs font-medium mb-1.5 block">Description (Optional)</Label>
        <Textarea
          placeholder="e.g. Includes free drink ticket and priority seating..."
          rows={2}
          {...register(`tickets.${index}.description` as const)}
          className="resize-none"
        />
      </div>
    </div>
  );
};
