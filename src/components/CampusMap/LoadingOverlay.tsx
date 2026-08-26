import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface LoadingOverlayProps {
  message?: string;
  isEmpty?: boolean;
}

export function LoadingOverlay({
  message = "Loading map data...",
  isEmpty = false,
}: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-[1000] bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
      <div className="bg-background shadow-lg rounded-xl p-6 flex flex-col items-center border border-border">
        {!isEmpty ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-foreground font-medium">{message}</p>
          </>
        ) : (
          <p className="text-foreground font-medium">No active events available.</p>
        )}
      </div>
    </div>
  );
}
