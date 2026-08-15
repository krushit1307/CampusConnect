import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LostFoundItem } from "@/routes/lost-found";

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // generic campus fallback

interface LostFoundMapViewProps {
  items: LostFoundItem[];
  onSelectCard?: (item: LostFoundItem) => void;
  className?: string;
}

export function LostFoundMapView({
  items,
  onSelectCard,
  className,
}: LostFoundMapViewProps) {
  // Filter active items with valid coordinates that are <= 30 days old
  const validMapItems = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      const hasCoords = typeof item.lat === "number" && typeof item.lng === "number";
      const isActive = item.status === "active";
      const isNotStale = new Date(item.created_at).getTime() >= thirtyDaysAgo;
      return hasCoords && isActive && isNotStale;
    });
  }, [items]);

  // Create custom marker icons
  const createCustomIcon = (type: "lost" | "found") => {
    const bgColor = type === "lost" ? "#ff8a8a" : "#baffb8";
    return L.divIcon({
      className: "custom-lf-marker",
      html: `
        <div style="
          width: 28px;
          height: 28px;
          background-color: ${bgColor};
          border: 2px solid black;
          box-shadow: 2px 2px 0px 0px rgba(0,0,0,1);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        ">
          <span style="font-size: 16px;">${type === "lost" ? "❓" : "🎁"}</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });
  };

  return (
    <div className={className}>
      <div className="h-[500px] w-full border-2 border-black overflow-hidden relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={15}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {validMapItems.map((item) => {
            const position: [number, number] = [item.lat as number, item.lng as number];
            return (
              <Marker
                key={item.id}
                position={position}
                icon={createCustomIcon(item.type)}
              >
                <Popup>
                  <div className="font-mono text-xs w-60 p-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-0.5 rounded-full border-2 border-black px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                        item.type === "lost" ? "bg-peach text-black" : "bg-lime text-black"
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-[10px] text-black/50 font-bold bg-cream px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-sm uppercase text-black line-clamp-1">{item.title}</h4>
                      <p className="text-[10px] text-black/60 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="border-t-2 border-black/10 pt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-[10px] text-black/70">
                        <strong>📍 Location:</strong> <span>{item.location || "N/A"}</span>
                      </div>
                      {item.floor_details && (
                        <div className="flex items-center gap-1 text-[10px] text-black/70">
                          <strong>🏢 Floor/Room:</strong> <span>{item.floor_details}</span>
                        </div>
                      )}
                      {item.bounty_amount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-900 font-bold">
                          <strong>💰 Bounty:</strong> <span>{item.bounty_amount} ConnectCoins</span>
                        </div>
                      )}
                    </div>

                    {onSelectCard && (
                      <button
                        onClick={() => onSelectCard(item)}
                        className="mt-1 w-full bg-[#ffde00] hover:bg-[#ffde00]/80 text-black border-2 border-black font-black uppercase text-[10px] py-1 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                      >
                        View Details / Claim
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
