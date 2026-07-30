import { Outlet, useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import EventsList from "./EventsList";
import { motion, AnimatePresence } from "framer-motion";

export default function EventsLayout() {
  const { eventId } = useParams();

  return (
    <SiteShell>
      <div className="h-[calc(100vh-64px)] lg:grid lg:grid-cols-12 overflow-hidden bg-cream">
        {/* Event List - hide on mobile if an event is selected */}
        <aside
          className={`lg:col-span-5 border-r-2 border-black overflow-y-auto h-full ${
            eventId ? "hidden lg:block" : "block"
          }`}
        >
          <EventsList />
        </aside>

        {/* Event Detail - show on mobile only if selected, always show on desktop */}
        <main
          className={`lg:col-span-7 overflow-y-auto h-full bg-white relative ${
            eventId ? "block" : "hidden lg:block"
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={eventId || "empty"}
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </SiteShell>
  );
}
