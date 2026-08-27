import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Share2, Sparkles, Trophy, Calendar, Clock, Compass, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Wrapped2026() {
  const supabase = createClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; size: number }>>([]);

  // Fetch wrapped data
  const { data: wrappedData, isLoading } = useQuery({
    queryKey: ["yearly-wrapped-2026"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data, error } = await supabase.rpc("get_yearly_wrapped", {
        p_user_id: user.id,
        p_year: 2026
      });

      if (error) throw error;
      return data || {
        total_events_attended: 0,
        total_hours_spent: 0,
        top_tag: "Tech",
        gamification_percentile: 100,
        top_events: []
      };
    }
  });

  // Confetti trigger
  useEffect(() => {
    if (currentSlide === 4) {
      const colors = ["#a3e635", "#6366f1", "#f43f5e", "#eab308", "#3b82f6"];
      const newConfetti = Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100 - 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6
      }));
      setConfetti(newConfetti);
    } else {
      setConfetti([]);
    }
  }, [currentSlide]);

  const handleNext = () => {
    setCurrentSlide((prev) => Math.min(prev + 1, 4));
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  };

  const handleShare = async () => {
    const shareText = `My 2026 Campus life in review: I attended ${wrappedData?.total_events_attended || 0} events, spent ${wrappedData?.total_hours_spent || 0} hours active, and ranked in the top ${wrappedData?.gamification_percentile || 100}% on CampusConnect! #2026Wrapped`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My 2026 Campus Life wrapped",
          text: shareText,
          url: window.location.href,
        });
        toast.success("Shared successfully!");
      } catch (err) {
        toast.error("Sharing cancelled.");
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Wrapped summary copied to clipboard! Share it on Instagram Stories.");
    }
  };

  if (isLoading) {
    return (
      <SiteShell>
        <div className="flex h-screen flex-col items-center justify-center bg-black text-white font-mono text-sm">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#a3e635]" />
          Generating your 2026 campus story...
        </div>
      </SiteShell>
    );
  }

  const slidesBackgrounds = [
    "radial-gradient(circle, #312e81 0%, #030712 100%)",
    wrappedData?.top_events?.[0]?.cover_image_url 
      ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url(${wrappedData.top_events[0].cover_image_url})` 
      : "radial-gradient(circle, #881337 0%, #030712 100%)",
    wrappedData?.top_events?.[1]?.cover_image_url 
      ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url(${wrappedData.top_events[1].cover_image_url})` 
      : "radial-gradient(circle, #1e3a8a 0%, #030712 100%)",
    wrappedData?.top_events?.[2]?.cover_image_url 
      ? `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url(${wrappedData.top_events[2].cover_image_url})` 
      : "radial-gradient(circle, #064e3b 0%, #030712 100%)",
    "radial-gradient(circle, #1e1b4b 0%, #000000 100%)"
  ];

  return (
    <SiteShell>
      <div 
        className="relative h-[85vh] flex flex-col justify-between overflow-hidden text-white"
        style={{ 
          background: slidesBackgrounds[currentSlide],
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {/* Progress Bar Header */}
        <div className="flex gap-1.5 p-4 z-10">
          {[0, 1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                i <= currentSlide ? "bg-[#a3e635]" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* Confetti canvas animation */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className="absolute rounded-full"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                backgroundColor: c.color,
                width: c.size,
                height: c.size
              }}
              animate={{
                y: ["0%", "120%"],
                x: [`${c.x}%`, `${c.x + (Math.random() * 20 - 10)}%`],
                rotate: [0, 360]
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>

        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12 z-10 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="max-w-xl mx-auto space-y-6"
            >
              {currentSlide === 0 && (
                <div className="space-y-4">
                  <motion.div 
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className="inline-block"
                  >
                    <Sparkles className="w-16 h-16 text-[#a3e635]" />
                  </motion.div>
                  <h2 className="text-5xl font-black uppercase tracking-tight font-display text-white">
                    Your 2026 Wrapped
                  </h2>
                  <p className="font-mono text-sm text-gray-400">
                    A beautiful story detailing your active campus involvement over the past year.
                  </p>
                </div>
              )}

              {currentSlide === 1 && (
                <div className="space-y-4">
                  <Calendar className="w-12 h-12 mx-auto text-rose-500" />
                  <h3 className="text-3xl font-bold uppercase font-display">You were active!</h3>
                  <h2 className="text-6xl font-black text-[#a3e635] tracking-tight">
                    {wrappedData?.total_events_attended} Events
                  </h2>
                  <p className="font-mono text-sm text-gray-300">
                    attended in 2026. From club general assemblies to massive campus carnivals!
                  </p>
                </div>
              )}

              {currentSlide === 2 && (
                <div className="space-y-4">
                  <Clock className="w-12 h-12 mx-auto text-indigo-400" />
                  <h3 className="text-3xl font-bold uppercase font-display">Time well spent</h3>
                  <h2 className="text-6xl font-black text-indigo-300 tracking-tight">
                    {wrappedData?.total_hours_spent} Hours
                  </h2>
                  <p className="font-mono text-sm text-gray-300">
                    active at campus events. Your primary passion was centered around{" "}
                    <span className="bg-indigo-600 text-white font-black px-2 py-0.5 rounded border border-indigo-500">
                      {wrappedData?.top_tag}
                    </span>!
                  </p>
                </div>
              )}

              {currentSlide === 3 && (
                <div className="space-y-4">
                  <Trophy className="w-12 h-12 mx-auto text-yellow-500" />
                  <h3 className="text-3xl font-bold uppercase font-display">Campus Leader</h3>
                  <h2 className="text-6xl font-black text-yellow-400 tracking-tight">
                    Top {wrappedData?.gamification_percentile}%
                  </h2>
                  <p className="font-mono text-sm text-gray-300">
                    on the Gamification Leaderboard. You earned heaps of points coordinating events!
                  </p>
                </div>
              )}

              {currentSlide === 4 && (
                <div className="space-y-6">
                  <Sparkles className="w-12 h-12 mx-auto text-[#a3e635]" />
                  <h2 className="text-3xl font-black uppercase font-display text-[#a3e635]">
                    2026 Campus Story
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 font-mono text-left max-w-sm mx-auto bg-white/10 p-5 rounded-lg border border-white/20">
                    <div>Events:</div>
                    <div className="font-bold text-right text-white">{wrappedData?.total_events_attended}</div>
                    <div>Hours spent:</div>
                    <div className="font-bold text-right text-white">{wrappedData?.total_hours_spent}h</div>
                    <div>Primary Tag:</div>
                    <div className="font-bold text-right text-white">{wrappedData?.top_tag}</div>
                    <div>Leaderboard:</div>
                    <div className="font-bold text-right text-[#a3e635]">Top {wrappedData?.gamification_percentile}%</div>
                  </div>

                  <div>
                    <Button
                      onClick={handleShare}
                      className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-bold uppercase w-full max-w-xs shadow-[4px_4px_0_0_#000] py-3 rounded-none flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Share to Stories
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between items-center p-6 bg-black/40 border-t border-white/10 z-10">
          <Button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className="bg-transparent hover:bg-white/10 text-white border-2 border-white/20 rounded-none font-mono text-xs uppercase flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Prev
          </Button>

          {currentSlide < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-[#a3e635] text-black hover:bg-lime-400 rounded-none font-mono text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Link
              to="/explore"
              className="bg-white text-black hover:bg-gray-100 px-4 py-2 border-2 border-black font-mono text-xs uppercase font-bold flex items-center gap-1.5"
            >
              Explore Events <Compass className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
