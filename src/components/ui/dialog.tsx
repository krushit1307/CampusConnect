"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

// Radix Dialog.Root wraps everything; we track open state via a context so
// DialogContent can drive AnimatePresence without prop-drilling.
const DialogOpenContext = React.createContext(false);

const Dialog = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => {
  const [isOpen, setIsOpen] = React.useState(open ?? defaultOpen ?? false);

  // Keep internal state in sync with controlled `open` prop
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <DialogOpenContext.Provider value={isOpen}>
      <DialogPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
};
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

// --- Overlay (backdrop) ---
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    asChild
  >
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
    />
  </DialogPrimitive.Overlay>
));
import { cva, type VariantProps } from "class-variance-authority";

const dialogContentVariants = cva(
  "fixed z-50 grid w-full gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg bottom-0 left-0 right-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:data-[state=open]:animate-in max-sm:data-[state=closed]:animate-out max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:fade-out-0 max-sm:data-[state=open]:fade-in-0 sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        brutalist:
          "border-2 border-black bg-white text-black dark:bg-black dark:text-cream shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        sheet: "border-l border-gray-200 bg-white text-gray-900 rounded-none h-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

// --- Content (the modal panel) ---
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ variant }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
