import { GraphCanvas } from "@/components/NetworkGraph";

export default function NetworkPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] px-4 pt-4 pb-2 gap-3">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Student Connection Graph
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            GPU-accelerated WebGL visualisation of campus connections across clubs
          </p>
        </div>
        <a
          href="https://github.com/krushit1307/CampusConnect/issues/739"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Issue #739
        </a>
      </div>

      {/* Full-height renderer */}
      <div className="flex-1 min-h-0">
        <GraphCanvas />
      </div>
    </div>
  );
}
