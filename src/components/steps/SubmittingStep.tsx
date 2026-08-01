import React from "react";
import { Loader2 } from "lucide-react";

export function SubmittingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-300">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <h2 className="text-xl font-semibold">Creating Event...</h2>
      <p className="text-muted-foreground mt-2">Please wait while we set things up.</p>
    </div>
  );
}
