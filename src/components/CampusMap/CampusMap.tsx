// src/components/CampusMap/CampusMap.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { CampusMapSVG } from './CampusMapSVG';
import { MapPin } from './MapPin';
import { MapEvent } from './EventPopover';
import { useMapCoordinates, PinCoordinate } from '../../hooks/useMapCoordinates';
import { Button } from '../ui/button';
import { ZoomIn, ZoomOut, Maximize2, MapPinned } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CampusMapProps {
  events: MapEvent[];
  onEventClick?: (eventId: string) => void;
  isAdminMode?: boolean;
  onAdminPinDrop?: (coord: PinCoordinate, eventId: string) => void;
  className?: string;
}

/**
 * Interactive, zoomable SVG map of the campus.
 * Wraps the SVG in `react-zoom-pan-pinch` to handle complex touch-panning
 * and pinch-to-zoom physics on mobile devices.
 */
export const CampusMap: React.FC<CampusMapProps> = ({
  events,
  onEventClick,
  isAdminMode = false,
  onAdminPinDrop,
  className,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getPercentageFromEvent } = useMapCoordinates();
  
  // Expose zoom controls from the inner component to the outer UI
  const Controls = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    return (
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
        <Button variant="secondary" size="icon" className="shadow-md bg-background/90 backdrop-blur" onClick={() => zoomIn()}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" className="shadow-md bg-background/90 backdrop-blur" onClick={() => zoomOut()}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" className="shadow-md bg-background/90 backdrop-blur" onClick={() => resetTransform()}>
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const handleMapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isAdminMode || !containerRef.current || !selectedEventId) return;

    const rect = containerRef.current.getBoundingClientRect();
    const percentages = getPercentageFromEvent(e, rect);

    onAdminPinDrop?.({
      id: `pin-${Date.now()}`,
      x: percentages.x,
      y: percentages.y,
      buildingName: 'Custom Location',
    }, selectedEventId);
  }, [isAdminMode, selectedEventId, getPercentageFromEvent, onAdminPinDrop]);

  // Map events to their stored coordinates (in a real app, these come from the DB)
  const mappedEvents = events.map(evt => ({
    ...evt,
    // Mock coordinates if not provided
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
  }));

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative w-full h-[600px] rounded-xl border overflow-hidden bg-muted shadow-inner',
        isAdminMode && selectedEventId && 'cursor-crosshair ring-2 ring-primary',
        className
      )}
    >
      {isAdminMode && (
        <div className="absolute top-4 left-4 z-20 bg-background/90 backdrop-blur p-3 rounded-lg shadow-md border max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <MapPinned className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Admin Mode: Pin Drop</span>
          </div>
          {!selectedEventId ? (
            <p className="text-xs text-muted-foreground">Select an event from the list to drop its pin on the map.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click anywhere on the map to set the location for <span className="font-bold text-foreground">Event #{selectedEventId}</span>.
            </p>
          )}
        </div>
      )}

      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={8}
        limitToBounds={true}
        centerOnInit={true}
        onZoom={(ref) => setScale(ref.state.scale)}
        doubleClick={{ disabled: true }} // Disable double click zoom to prevent accidental map movement when tapping pins
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full"
        >
          <div className="relative w-full h-full">
            <CampusMapSVG 
              className="w-full h-full" 
              onMapClick={handleMapClick} 
            />
            
            {/* Render Pins */}
            {mappedEvents.map((evt) => (
              <MapPin
                key={evt.id}
                event={evt}
                x={evt.x}
                y={evt.y}
                scale={scale}
                onViewDetails={(id) => onEventClick?.(id)}
              />
            ))}
          </div>
        </TransformComponent>
        <Controls />
      </TransformWrapper>
    </div>
  );
};
