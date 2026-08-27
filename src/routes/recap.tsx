import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import X from "lucide-react/dist/esm/icons/x";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface RecapData {
  total_events_attended: number;
  top_category: string;
  top_category_count: number;
  most_visited_club: string;
  total_comments_posted: number;
  busiest_month: string;
  user_percentile: number;
}

const SLIDE_DURATION_MS = 5000;

export default function RecapPage() {
  const navigate = useNavigate();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const year = new Date().getFullYear();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      } else {
        navigate("/auth");
      }
    });
  }, [supabase, navigate]);

  const { data: recap, isLoading } = useQuery<RecapData>({
    queryKey: ["yearly_recap", userId, year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("generate_yearly_recap", {
        user_id: userId,
        target_year: year,
      });
      if (error) throw error;
      return data as RecapData;
    },
    enabled: !!userId,
  });

  const totalSlides = recap && recap.total_events_attended > 0 ? 6 : 2;

  // Handle slide progress interval
  useEffect(() => {
    if (isLoading || !recap) return;

    setProgress(0);
    const intervalTime = 50;
    const increment = (intervalTime / SLIDE_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((slide) => {
            if (slide < totalSlides - 1) {
              return slide + 1;
            } else {
              clearInterval(timer);
              return slide;
            }
          });
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentSlide, isLoading, recap, totalSlides]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
      setProgress(0);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
      setProgress(0);
    }
  };

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const width = e.currentTarget.offsetWidth;
    const x = e.nativeEvent.offsetX;
    if (x < width * 0.3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const handleShare = async () => {
    if (!userId) return;
    const shareUrl = `${window.location.origin}/recap?user_id=${userId}&year=${year}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My CampusConnect Wrapped!",
          text: `Check out my CampusConnect recap for ${year}! I attended ${recap?.total_events_attended} events!`,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast.error("Failed to share.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied to clipboard!");
      } catch {
        toast.error("Failed to copy link.");
      }
    }
  };

  if (isLoading || !recap) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream text-black p-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="mt-4 font-mono text-sm font-bold uppercase tracking-wider">
          Aggregating your year on campus...
        </p>
      </div>
    );
  }

  const hasActivity = recap.total_events_attended > 0;

  const renderSlideContent = () => {
    if (!hasActivity) {
      switch (currentSlide) {
        case 0:
          return (
            <motion.div
              key="zero0"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md border-4 border-black bg-[#facc15] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6"
            >
              <span className="inline-block border-2 border-black bg-white p-2 font-mono text-xs font-bold uppercase">
                Quiet Year 🤫
              </span>
              <h2 className="font-display text-4xl font-extrabold tracking-tight uppercase leading-none">
                You were quiet this year!
              </h2>
              <p className="font-mono text-sm text-black/80">
                You didn&apos;t check in to any events during {year}. Let&apos;s change that next
                semester!
              </p>
            </motion.div>
          );
        case 1:
          return (
            <motion.div
              key="zero1"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="w-full max-w-md border-4 border-black bg-[#22d3ee] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6"
            >
              <h2 className="font-display text-4xl font-extrabold uppercase leading-none">
                Ready to explore?
              </h2>
              <p className="font-mono text-sm text-black/80">
                There are hundreds of clubs and communities waiting for you on CampusConnect.
              </p>
              <button
                onClick={() => navigate("/clubs")}
                className="w-full border-4 border-black bg-[#a3e635] py-3 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1"
              >
                Discover Clubs Now
              </button>
            </motion.div>
          );
        default:
          return null;
      }
    }

    switch (currentSlide) {
      case 0:
        return (
          <motion.div
            key="slide0"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="w-full max-w-md border-4 border-black bg-[#fb923c] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6"
          >
            <div className="flex justify-center">
              <Sparkles className="h-16 w-16 text-black animate-pulse" />
            </div>
            <h2 className="font-display text-5xl font-extrabold uppercase tracking-tight leading-none text-black">
              Your Year in Review
            </h2>
            <p className="font-mono text-lg font-bold bg-white text-black py-2 border-2 border-black inline-block px-4">
              {year} EDITION
            </p>
            <p className="font-mono text-sm text-black/80">
              Let&apos;s take a visual journey through your campus life and achievements.
            </p>
          </motion.div>
        );
      case 1:
        return (
          <motion.div
            key="slide1"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="w-full max-w-md border-4 border-black bg-[#a3e635] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] space-y-6"
          >
            <span className="inline-block border-2 border-black bg-black text-white px-3 py-1 font-mono text-xs font-bold uppercase">
              Events Attended 📅
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none text-black">
              You checked in to
            </h2>
            <div className="flex items-center gap-4">
              <motion.span
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="font-display text-7xl font-extrabold text-black bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
              >
                {recap.total_events_attended}
              </motion.span>
              <span className="font-mono text-xl font-bold uppercase text-black">events!</span>
            </div>
            <p className="font-mono text-sm text-black/70">
              You were extremely busy exploring campus life this year!
            </p>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="slide2"
            initial={{ scale: 0.8, rotate: -3 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8 }}
            className="w-full max-w-md border-4 border-black bg-[#facc15] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] space-y-6"
          >
            <span className="inline-block border-2 border-black bg-white text-black px-3 py-1 font-mono text-xs font-bold uppercase">
              Top Category 🎯
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none text-black">
              Your favorite focus was
            </h2>
            <div className="border-4 border-black bg-[#e11d48] text-white p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)] text-center">
              <h3 className="font-display text-5xl font-black uppercase">{recap.top_category}</h3>
              <p className="font-mono text-xs uppercase mt-2 tracking-widest text-white/80">
                {recap.top_category_count} total events attended
              </p>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="slide3"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="w-full max-w-md border-4 border-black bg-[#22d3ee] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] space-y-6"
          >
            <span className="inline-block border-2 border-black bg-black text-white px-3 py-1 font-mono text-xs font-bold uppercase">
              Top Club 🏆
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none text-black">
              Most visited community
            </h2>
            <div className="border-4 border-black bg-white p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)] text-center">
              <h3 className="font-display text-3xl font-extrabold uppercase text-black">
                {recap.most_visited_club}
              </h3>
            </div>
            <p className="font-mono text-sm text-black/70 text-center">
              Your home away from home. Keep supporting your favorite club!
            </p>
          </motion.div>
        );
      case 4:
        return (
          <motion.div
            key="slide4"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md border-4 border-black bg-[#f43f5e] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-white space-y-6"
          >
            <span className="inline-block border-2 border-white bg-white text-black px-3 py-1 font-mono text-xs font-bold uppercase">
              Social Stats 💬
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none">
              Your voice was heard
            </h2>
            <div className="flex items-center gap-4">
              <span className="font-display text-7xl font-extrabold bg-black text-white border-4 border-white px-6 py-2 shadow-[4px_4px_0px_rgba(255,255,255,1)]">
                {recap.total_comments_posted}
              </span>
              <span className="font-mono text-xl font-bold uppercase">comments posted</span>
            </div>
            <p className="font-mono text-sm text-white/80">
              Busiest month:{" "}
              <strong className="uppercase bg-white text-black px-2 py-0.5 border border-black">
                {recap.busiest_month}
              </strong>
            </p>
          </motion.div>
        );
      case 5:
        return (
          <motion.div
            key="slide5"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            className="w-full max-w-md border-4 border-black bg-[#a3e635] p-8 shadow-[8px_8px_0px_rgba(0,0,0,1)] text-center space-y-6"
          >
            <span className="inline-block border-2 border-black bg-white text-black px-3 py-1 font-mono text-xs font-bold uppercase">
              Leader Status 👑
            </span>
            <h2 className="font-display text-4xl font-extrabold uppercase leading-none text-black">
              You are in the top
            </h2>
            <div className="border-4 border-black bg-black text-lime p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <h3 className="font-display text-6xl font-black">{recap.user_percentile}%</h3>
              <p className="font-mono text-xs uppercase tracking-widest text-lime/80">
                of active students
              </p>
            </div>
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 border-4 border-black bg-white py-3 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 active:translate-y-0"
            >
              <Share2 className="h-4 w-4" /> Share Wrapped
            </button>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <div className="absolute top-4 left-4 right-4 z-20 flex gap-1.5 max-w-md mx-auto">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <div key={idx} className="h-1.5 flex-1 bg-black/20 rounded-none overflow-hidden">
            <div
              className="h-full bg-black transition-all ease-linear"
              style={{
                width: idx < currentSlide ? "100%" : idx === currentSlide ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/dashboard")}
        className="absolute top-8 right-4 z-20 border-2 border-black bg-white p-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105 active:scale-95"
        aria-label="Exit recap"
      >
        <X className="h-5 w-5 text-black" />
      </button>

      <div
        className="relative flex w-full max-w-md h-[500px] items-center justify-center cursor-pointer select-none"
        onClick={handleScreenClick}
      >
        <AnimatePresence mode="wait">{renderSlideContent()}</AnimatePresence>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          disabled={currentSlide === 0}
          className="absolute -left-12 top-1/2 -translate-y-1/2 hidden sm:flex border-2 border-black bg-white p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          disabled={currentSlide === totalSlides - 1}
          className="absolute -right-12 top-1/2 -translate-y-1/2 hidden sm:flex border-2 border-black bg-white p-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
