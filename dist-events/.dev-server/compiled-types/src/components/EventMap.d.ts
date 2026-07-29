import "leaflet/dist/leaflet.css";
interface EventMapProps {
    lat: number;
    lng: number;
    locationName?: string;
}
export declare function EventMap({ lat, lng, locationName }: EventMapProps): import("react").JSX.Element;
export {};
