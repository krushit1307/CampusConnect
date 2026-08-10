import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronRight, ChevronLeft, Award, Image as ImageIcon, Calendar } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";

const Slide = ({ children, direction }: { children: React.ReactNode; direction: number }) => {
  return (
    <motion.div
      key="slide"
      initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction < 0 ? 100 : -100 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
    >
      {children}
    </motion.div>
  );
};

function MemoryLaneContent({ user }: WithAuthProps) {
  const supabase = createClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["memory-lane", user.id],
    queryFn: async () => {
      // Fetch user's basic stats
      const { count: eventCount } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "attending");

      const { count: clubCount } = await supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", user.id)
        .single();

      return {
        eventCount: eventCount || 0,
        clubCount: clubCount || 0,
        joinedAt: profile?.created_at ? new Date(profile.created_at).getFullYear() : 2022,
      };
    },
  });

  const nextSlide = () => {
    setDirection(1);
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  const slides = [
    <div key="1" className="space-y-6 text-white">
      <h1 className="font-display text-5xl font-extrabold md:text-7xl">
        Your CampusConnect<br />Journey.
      </h1>
      <p className="font-mono text-xl">Let's take a walk down Memory Lane...</p>
    </div>,
    <div key="2" className="space-y-6 text-[#a3e635]">
      <Calendar className="mx-auto h-24 w-24" />
      <h2 className="font-display text-4xl font-bold">You attended</h2>
      <p className="text-8xl font-black">{data.eventCount}</p>
      <p className="font-mono text-2xl uppercase">Events</p>
    </div>,
    <div key="3" className="space-y-6 text-[#0bc5ea]">
      <Award className="mx-auto h-24 w-24" />
      <h2 className="font-display text-4xl font-bold">You were part of</h2>
      <p className="text-8xl font-black">{data.clubCount}</p>
      <p className="font-mono text-2xl uppercase">Clubs</p>
    </div>,
    <div key="4" className="space-y-6 text-[#fb923c]">
      <h2 className="font-display text-5xl font-black">Thank you for being part of our community since {data.joinedAt}!</h2>
      <p className="font-mono text-xl text-white">Happy Graduation! 🎓</p>
    </div>,
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black selection:bg-lime/30">
      <AnimatePresence initial={false} custom={direction}>
        <Slide direction={direction}>{slides[currentSlide]}</Slide>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-10 flex items-center justify-center gap-4">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-white transition hover:bg-white hover:text-black disabled:opacity-30"
        >
          <ChevronLeft />
        </button>
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full transition-all ${
                idx === currentSlide ? "w-6 bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
        <button
          onClick={nextSlide}
          disabled={currentSlide === slides.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-white transition hover:bg-white hover:text-black disabled:opacity-30"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

export default withAuth(MemoryLaneContent);
