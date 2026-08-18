import React from "react";
import { motion } from "framer-motion";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Award from "lucide-react/dist/esm/icons/award";
import Users from "lucide-react/dist/esm/icons/users";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import Star from "lucide-react/dist/esm/icons/star";
import Zap from "lucide-react/dist/esm/icons/zap";
import { TimelineMilestone } from "./Timeline";

interface TimelineEventProps {
  /** The milestone data to render */
  milestone: TimelineMilestone;
  /** The index of the event in the timeline array (used for staggered animations) */
  index: number;
  /** Boolean indicating if this event is currently the active/centered event */
  isActive: boolean;
}

/**
 * Maps icon string names to actual Lucide React components.
 * This allows the parent component to pass a simple string identifier
 * while this component renders the correct SVG icon.
 */
const ICON_MAP: Record<string, React.FC<any>> = {
  calendar: Calendar,
  award: Award,
  users: Users,
  rocket: Rocket,
  star: Star,
  zap: Zap,
};

/**
 * TimelineEvent Component
 *
 * Represents a single card within the horizontal Timeline.
 * It is configured with CSS scroll snapping (`scroll-snap-align: center`)
 * to ensure that when the user swipes or scrolls, the card perfectly
 * locks into the dead center of the viewport.
 *
 * It features a dynamic scale and opacity effect based on its active state,
 * providing a visually engaging "focus" effect as the user navigates through
 * the club's history.
 */
const TimelineEvent: React.FC<TimelineEventProps> = ({ milestone, index, isActive }) => {
  // Resolve the icon component from the map, defaulting to a Star if not found
  const IconComponent = ICON_MAP[milestone.icon || "star"] || Star;

  return (
    <motion.div
      data-timeline-event
      data-year={milestone.year}
      initial={{ opacity: 0, y: 50 }}
      animate={{
        opacity: 1,
        y: 0,
        // Scale up slightly when active to draw attention
        scale: isActive ? 1.05 : 1,
      }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        scale: { type: "spring", stiffness: 300, damping: 20 },
      }}
      className="relative flex-shrink-0 w-[80%] sm:w-[60%] md:w-[40%] lg:w-[30%] scroll-snap-align-center z-10"
      style={{
        // Enforce scroll snap alignment for the fluid snapping behavior
        scrollSnapAlign: "center",
      }}
    >
      <div
        className={`
          relative h-full p-6 rounded-2xl shadow-xl transition-all duration-300
          bg-white dark:bg-slate-800 
          border-2 
          ${
            isActive
              ? "border-indigo-500 dark:border-indigo-400 shadow-indigo-200 dark:shadow-indigo-900/50"
              : "border-gray-100 dark:border-slate-700"
          }
        `}
      >
        {/* Decorative Node connecting the card to the background timeline line */}
        <div
          className={`
            absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-4 
            flex items-center justify-center transition-colors duration-300
            ${
              isActive
                ? "bg-indigo-500 border-white dark:border-slate-900"
                : "bg-gray-300 dark:bg-slate-600 border-white dark:border-slate-900"
            }
          `}
        >
          <IconComponent className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>

        {/* Card Content */}
        <div className="mt-4">
          {/* Year Badge */}
          <div className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 rounded-full uppercase">
            {milestone.year}
          </div>

          {/* Event Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
            {milestone.title}
          </h3>

          {/* Event Image (if provided) */}
          {milestone.imageUrl && (
            <div className="mb-4 rounded-lg overflow-hidden shadow-inner">
              <img
                src={milestone.imageUrl}
                alt={milestone.title}
                className="w-full h-40 object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          {/* Event Description */}
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            {milestone.description}
          </p>
        </div>

        {/* Active Indicator Glow */}
        {isActive && (
          <motion.div
            layoutId="activeTimelineGlow"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 blur-xl" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default TimelineEvent;
