import { MapViewType } from "./hooks/useMapView";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Flame from "lucide-react/dist/esm/icons/flame";

interface MapToggleProps {
  view: MapViewType;
  onToggle: () => void;
}

export function MapToggle({ view, onToggle }: MapToggleProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-background/95 backdrop-blur shadow-md rounded-md p-1 flex items-center border border-border">
      <button
        type="button"
        className={`px-3 py-1.5 flex items-center gap-2 text-sm font-medium rounded-sm transition-colors ${
          view === "pins"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted"
        }`}
        onClick={() => view !== "pins" && onToggle()}
        aria-pressed={view === "pins"}
        aria-label="Switch to Pin View"
      >
        <MapPin className="w-4 h-4" />
        Pins
      </button>
      <button
        type="button"
        className={`px-3 py-1.5 flex items-center gap-2 text-sm font-medium rounded-sm transition-colors ${
          view === "heatmap"
            ? "bg-red-500 text-white shadow-sm"
            : "text-muted-foreground hover:bg-muted"
        }`}
        onClick={() => view !== "heatmap" && onToggle()}
        aria-pressed={view === "heatmap"}
        aria-label="Switch to Heatmap View"
      >
        <Flame className="w-4 h-4" />
        Heatmap
      </button>
    </div>
  );
}
