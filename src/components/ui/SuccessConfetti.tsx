// src/components/ui/SuccessConfetti.tsx
import React, { useEffect, useState } from "react";
import { AnimationPlayer } from "./AnimationPlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "./button";
import { CheckCircle2 } from "lucide-react";

interface SuccessConfettiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Modal overlay that plays a success confetti dotLottie animation.
 * The .lottie format ensures the complex particle effects are
 * delivered in a fraction of the original JSON file size.
 */
export const SuccessConfetti: React.FC<SuccessConfettiProps> = ({
  open,
  onOpenChange,
  title = "Success!",
  description = "Your action was completed successfully.",
  actionLabel = "Continue",
  onAction,
}) => {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog transition completes before heavy animation starts
      const timer = setTimeout(() => setShowAnimation(true), 150);
      return () => {
        clearTimeout(timer);
        setShowAnimation(false);
      };
    } else {
      setShowAnimation(false);
    }
  }, [open]);

  const handleContinue = () => {
    onAction?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center text-center pt-4">
          {showAnimation && (
            <div className="w-48 h-48 mb-2 pointer-events-none">
              <AnimationPlayer
                type="success-confetti"
                loop={false}
                autoplay={true}
                altText="Success Confetti"
              />
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
          </div>

          <p className="text-muted-foreground mb-6 max-w-xs">{description}</p>

          <Button onClick={handleContinue} className="w-full sm:w-auto min-w-[120px]" size="lg">
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
