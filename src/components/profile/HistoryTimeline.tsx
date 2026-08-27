import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Building from "lucide-react/dist/esm/icons/building";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { Link } from "react-router-dom";

export interface TimelineItem {
  id: string;
  type: "club_join" | "rsvp" | "post";
  date: string;
  title: string;
  description: string;
  link: string;
}

interface HistoryTimelineProps {
  items: TimelineItem[];
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ items }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  if (!items || items.length === 0) {
    return (
      <div className="neu-border bg-cream p-8 text-center md:p-12">
        <p className="font-mono text-sm text-gray-500">No activity history recorded yet.</p>
      </div>
    );
  }

  const getIcon = (type: TimelineItem["type"]) => {
    switch (type) {
      case "club_join":
        return <Building className="h-5 w-5 text-black" />;
      case "rsvp":
        return <Calendar className="h-5 w-5 text-black" />;
      case "post":
        return <MessageSquare className="h-5 w-5 text-black" />;
    }
  };

  const getBadgeColor = (type: TimelineItem["type"]) => {
    switch (type) {
      case "club_join":
        return "bg-peach";
      case "rsvp":
        return "bg-lime";
      case "post":
        return "bg-sky";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-4xl mx-auto py-12 px-4 overflow-hidden"
    >
      <div className="absolute top-0 bottom-0 left-[28px] md:left-1/2 -translate-x-1/2 w-2 h-full pointer-events-none z-0">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 8 100" fill="none">
          <line
            x1="4"
            y1="0"
            x2="4"
            y2="100"
            stroke="#E5E7EB"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <motion.line
            x1="4"
            y1="0"
            x2="4"
            y2="100"
            stroke="#A3E635"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ pathLength }}
          />
        </svg>
      </div>

      <div className="relative space-y-12">
        {items.map((item, index) => {
          const isEven = index % 2 === 0;

          return (
            <div
              key={item.id}
              className={`flex flex-col md:flex-row items-start md:items-center justify-between w-full relative ${
                isEven ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="hidden md:block w-5/12" />

              <motion.div
                className={`absolute left-0 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full border-2 border-black flex items-center justify-center z-10 shadow-[2px_2px_0_0_#000] transition-colors duration-300`}
                initial={{ scale: 0.8, backgroundColor: "#FFFFFF" }}
                whileInView={{
                  scale: 1.1,
                  backgroundColor: "#A3E635",
                }}
                viewport={{ once: false, amount: 0.8, margin: "-10% 0px -40% 0px" }}
              >
                {getIcon(item.type)}
              </motion.div>

              <motion.div
                className="w-full pl-12 md:pl-0 md:w-5/12"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="neu-border bg-white p-6 relative neu-shadow transition-transform hover:-translate-y-1">
                  <div
                    className={`absolute top-0 right-0 h-4 w-4 border-b-2 border-l-2 border-black ${getBadgeColor(item.type)}`}
                  />

                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="font-mono text-xs text-gray-500 font-bold">
                      {new Date(item.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-black uppercase px-2 py-0.5 border border-black ${getBadgeColor(item.type)}`}
                    >
                      {item.type.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-black mb-2 truncate">
                    {item.title}
                  </h3>

                  <p className="font-mono text-sm text-gray-700 leading-relaxed line-clamp-3 mb-4">
                    {item.description}
                  </p>

                  <Link
                    to={item.link}
                    className="inline-flex items-center gap-1 font-mono text-xs font-bold underline hover:no-underline text-black group"
                  >
                    View Details
                    <span className="transform group-hover:translate-x-1 transition-transform inline-block">
                      →
                    </span>
                  </Link>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
