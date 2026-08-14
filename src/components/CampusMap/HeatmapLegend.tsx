export function HeatmapLegend() {
  return (
    <div className="absolute bottom-6 right-4 z-[1000] bg-background/95 backdrop-blur shadow-md rounded-md p-3 border border-border text-xs">
      <div className="font-semibold mb-2 text-foreground">Activity Intensity</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-blue-500" />
          <span className="text-muted-foreground">Low Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-green-500" />
          <span className="text-muted-foreground">Slight Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-yellow-400" />
          <span className="text-muted-foreground">Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-orange-500" />
          <span className="text-muted-foreground">High Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-red-600" />
          <span className="text-muted-foreground">Very Dense</span>
        </div>
      </div>
    </div>
  );
}
