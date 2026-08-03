import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SplitPaneProps {
  /** The sidebar content (e.g., navigation) */
  sidebar: React.ReactNode;
  /** The main content area (e.g., data tables, forms) */
  mainContent: React.ReactNode;
  /** Minimum width of the sidebar in pixels */
  minSidebarWidth?: number;
  /** Maximum width of the sidebar in pixels (optional) */
  maxSidebarWidth?: number;
  /** Default width of the sidebar in pixels */
  defaultSidebarWidth?: number;
  /** LocalStorage key to persist the sidebar width */
  storageKey?: string;
}

/**
 * SplitPane Component
 * 
 * Provides a draggable vertical divider between a sidebar and main content area.
 * 
 * Key Features:
 * - Persists user preference in localStorage.
 * - Enforces min/max width constraints.
 * - CRITICAL: Applies `pointer-events: none` to the main content area during 
 *   dragging to prevent iframe mouse event trapping (a common browser bug where 
 *   mousemove events stop firing when the cursor enters an iframe).
 */
export const SplitPane: React.FC<SplitPaneProps> = ({
  sidebar,
  mainContent,
  minSidebarWidth = 200,
  maxSidebarWidth = 600,
  defaultSidebarWidth = 280,
  storageKey = 'campusconnect-admin-sidebar-width',
}) => {
  // Initialize width from localStorage or fallback to default
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        // Ensure stored value is within bounds
        return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, parsed));
      }
    }
    return defaultSidebarWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Persist width to localStorage whenever it changes and is valid
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, sidebarWidth.toString());
    }
  }, [sidebarWidth, storageKey]);

  // Handle mouse down on the resizer
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
    },
    [sidebarWidth]
  );

  // Handle global mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      let newWidth = startWidthRef.current + delta;

      // Enforce constraints
      newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
      
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Attach listeners to window to ensure we catch events even if mouse moves fast
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Cleanup listeners on unmount or when dragging stops
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minSidebarWidth, maxSidebarWidth]);

  // Prevent text selection while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar Area */}
      <aside 
        className="flex-shrink-0 bg-background border-r border-border transition-none"
        style={{ width: `${sidebarWidth}px` }}
      >
        {sidebar}
      </aside>

      {/* Resizer Handle */}
      <div
        className={`resizer cursor-col-resize w-1 bg-border hover:bg-primary/50 active:bg-primary transition-colors flex-shrink-0 relative z-10 ${
          isDragging ? 'bg-primary' : ''
        }`}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-valuenow={sidebarWidth}
        aria-valuemin={minSidebarWidth}
        aria-valuemax={maxSidebarWidth}
        aria-label="Resize sidebar"
        tabIndex={0}
      >
        {/* Visual grip indicator */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 flex items-center justify-center">
          <div className="h-8 w-1 bg-muted-foreground/30 rounded-full" />
        </div
      </div>

      {/* Main Content Area */}
      <main 
        className="flex-1 overflow-auto bg-background relative"
        // CRITICAL FIX: Disable pointer events on main content while dragging 
        // to prevent iframe from stealing mousemove events.
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      >
        {mainContent}
      </main>
    </div>
  );
};

export default SplitPane;
