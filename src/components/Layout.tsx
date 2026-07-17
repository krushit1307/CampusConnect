import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeToggle";
import TopProgressBar from "@/components/TopProgressBar";

export default function Layout() {
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Auth state changed. In a standard SPA, components depending on auth will re-render
      // or we can refresh the page if absolutely necessary, but we leave it to components for now.
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <TopProgressBar />
        <Outlet />
        <Toaster />
        <ScrollToTop />
      </TooltipProvider>
    </ThemeProvider>
  );
}
