import React from "react";

export function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto w-full p-4 sm:p-6 lg:p-8 bg-card text-card-foreground rounded-lg border shadow-sm mt-8">
      <h1 className="text-2xl font-bold mb-6">Create New Event</h1>
      {children}
    </div>
  );
}
