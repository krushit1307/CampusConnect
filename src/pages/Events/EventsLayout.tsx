import { Outlet, useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import EventsList from "./EventsList";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from "@/components/BottomSheet";

export default function EventsLayout() {
  const { eventId } = useParams();

  return (
    <SiteShell>
      <div className="h-[calc(100vh-64px)] lg:grid lg:grid-cols-12 overflow-hidden bg-cream">
        {/* Event List - always show on mobile so it stays in background */}
        <aside className={`lg:col-span-5 border-r-2 border-black overflow-y-auto h-full block`}>
          <EventsList />
        </aside>

        {/* Event Detail - Desktop */}
        <main className={`lg:col-span-7 overflow-y-auto h-full bg-white relative hidden lg:block`}>
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

        {/* Event Detail - Mobile Bottom Sheet Overlay */}
        <div className="block lg:hidden">
          {eventId && (
            <BottomSheet>
              <Outlet />
            </BottomSheet>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
