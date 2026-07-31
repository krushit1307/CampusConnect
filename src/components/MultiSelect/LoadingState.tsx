import React from "react";
import { Command } from "cmdk";

export function LoadingState() {
  return (
    <Command.Loading className="py-6 text-center text-sm text-muted-foreground">
      Loading...
    </Command.Loading>
  );
}
