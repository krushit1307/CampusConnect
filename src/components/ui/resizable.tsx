import { GripVertical } from "lucide-react";
import { useCallback, useState, useRef, useEffect } from "react";
import { Group, Panel, Separator, Layout } from "react-resizable-panels";

import { cn } from "@/lib/utils";

interface ResizablePanelGroupProps {
  className?: string;
  onLayout?: (sizes: number[]) => void;
  children?: React.ReactNode;
  [key: string]: unknown;
}

const ResizablePanelGroup = ({ className, onLayout, ...props }: ResizablePanelGroupProps) => {
  const [announcement, setAnnouncement] = useState("");

  const handleLayout = useCallback(
    (layout: Layout) => {
      const sizes = Object.values(layout);
      if (sizes.length > 0) {
        setAnnouncement(`Panels resized: ${sizes.map((s) => `${Math.round(s)}%`).join(", ")}`);
      }
      onLayout?.(sizes);
    },
    [onLayout],
  );

  return (
    <>
      <Group
        className={cn(
          "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
          className,
        )}
        onLayoutChange={handleLayout}
        {...(props as unknown as React.ComponentProps<typeof Group>)}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
};

const ResizablePanel = Panel;

interface ResizableHandleProps {
  withHandle?: boolean;
  className?: string;
  tabIndex?: number;
  [key: string]: unknown;
}

const SeparatorWithTabIndex = Separator as unknown as React.ComponentType<
  React.ComponentProps<typeof Separator> & { tabIndex?: number }
>;

const ResizableHandle = ({ withHandle, className, ...props }: ResizableHandleProps) => {
  const handleRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        requestAnimationFrame(() => {
          const valuenow = el.getAttribute("aria-valuenow");
          if (valuenow) {
            setAnnouncement(`Panel resized to ${Math.round(Number(valuenow))} percent`);
          }
        });
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <SeparatorWithTabIndex
        tabIndex={0}
        aria-label="Drag to resize or use arrow keys"
        className={cn(
          "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
          className,
        )}
        elementRef={handleRef}
        {...(props as unknown as React.ComponentProps<typeof Separator>)}
      >
        {withHandle && (
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        )}
      </SeparatorWithTabIndex>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
