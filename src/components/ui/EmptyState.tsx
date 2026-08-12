// src/components/ui/EmptyState.tsx
import React from "react";
import { AnimationPlayer, AnimationType } from "./AnimationPlayer";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { ArrowRight } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  animationType?: Extract<AnimationType, "empty-state" | "search-empty" | "network-offline">;
  className?: string;
}

/**
 * Reusable Empty State component utilizing dotLottie animations.
 * Displays a compressed .lottie animation alongside contextual text
 * and an optional call-to-action button.
 *
 * Used across the app for empty lists, search results, and offline states.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  animationType = "empty-state",
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 max-w-md mx-auto",
        className,
      )}
    >
      <div className="w-64 h-64 mb-6">
        <AnimationPlayer
          type={animationType}
          loop={false}
          autoplay={true}
          altText={`Illustration for ${title}`}
        />
      </div>

      <h3 className="text-2xl font-semibold text-foreground mb-2">{title}</h3>

      {description && (
        <p className="text-muted-foreground mb-6 leading-relaxed max-w-sm">{description}</p>
      )}

      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size="lg"
          className="gap-2 shadow-sm transition-transform hover:scale-105"
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
