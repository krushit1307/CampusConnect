"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "@/lib/utils";
import { generateDeterministicAvatarSvg } from "@/lib/avatarGenerator";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    isOnline?: boolean;
    seed?: string;
  }
>(({ className, isOnline, seed, ...props }, ref) => {
  const avatarContent = (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );

  if (isOnline) {
    return (
      <div className="relative inline-block shrink-0">
        {avatarContent}
        <span
          className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          data-testid="presence-indicator"
        />
      </div>
    );
  }

  return avatarContent;
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
    seed?: string;
  }
>(({ className, seed, children, ...props }, ref) => {
  const deterministicAvatar = React.useMemo(() => {
    if (seed) {
      return generateDeterministicAvatarSvg(seed);
    }
    return null;
  }, [seed]);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-xs",
        className
      )}
      {...props}
    >
      {deterministicAvatar ? (
        <img
          src={deterministicAvatar.dataUrl}
          alt="Generated Avatar"
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        children
      )}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
