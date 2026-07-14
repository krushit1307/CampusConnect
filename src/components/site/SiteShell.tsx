import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="college-shell flex min-h-screen flex-col text-black">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
