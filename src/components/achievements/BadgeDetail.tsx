import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Circle, Trophy, Sparkles, BarChart3, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TIER_META, CATEGORY_META, type Achievement } from "@/types/achievements";
import { cn } from "@/lib/utils";

interface BadgeDetailProps {
  achievement: Achievement | null;
  onClose: () => void;
}

export function BadgeDetail({ achievement, onClose }: BadgeDetailProps) {
  if (!achievement) return null;

  const tierMeta = TIER_META[achievement.tier];
  const catMeta = CATEGORY_META[achievement.category];
  const isUnlocked = achievement.status === "unlocked";

  // Generate mock progress steps based on requirement_total
  const steps = Array.from({ length: achievement.requirement_total }, (_, i) => ({
    label: `Step ${i + 1} of ${achievement.requirement_total}`,
    completed: i < achievement.requirement_current,
  }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn("px-5 py-5 border-b", tierMeta.bgClass)}>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs font-bold">
                {tierMeta.icon} {tierMeta.label} Tier
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-5 py-5">
            <div className="space-y-5">
              {/* Big emoji + name */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className={cn(
                    "h-24 w-24 rounded-2xl mx-auto flex items-center justify-center text-5xl mb-4",
                    isUnlocked ? tierMeta.bgClass : "bg-gray-100",
                  )}
                >
                  {isUnlocked ? achievement.icon_emoji : "🔒"}
                </motion.div>
                <h2 className="text-xl font-black text-gray-900">{achievement.name}</h2>
                <Badge variant="secondary" className={cn("text-xs mt-2", catMeta.bgClass)}>
                  {catMeta.icon} {catMeta.label}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                {achievement.description}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <Trophy className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-indigo-700">{achievement.points}</p>
                  <p className="text-[10px] font-bold uppercase text-indigo-500">Points</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <Sparkles className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-amber-700">{achievement.rarity_pct}%</p>
                  <p className="text-[10px] font-bold uppercase text-amber-500">Rarity</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 text-center">
                  <BarChart3 className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-gray-700">{achievement.progress_pct}%</p>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Progress</p>
                </div>
              </div>

              {/* Progress overview */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Progress
                  </h4>
                  <span className="text-xs font-mono text-gray-400">
                    {achievement.requirement_current}/{achievement.requirement_total}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${achievement.progress_pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                    className={cn(
                      "h-full rounded-full",
                      isUnlocked ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  />
                </div>

                {/* Step-by-step */}
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="flex items-center gap-2"
                    >
                      {step.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs",
                          step.completed ? "text-gray-600 line-through" : "text-gray-400",
                        )}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Unlocked date */}
              {isUnlocked && achievement.unlocked_at && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700">
                    Unlocked on{" "}
                    {new Date(achievement.unlocked_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}

              {/* Locked message */}
              {!isUnlocked && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center text-xs text-gray-500">
                  {achievement.status === "in_progress"
                    ? "Keep going — you're making progress on this badge!"
                    : "Complete the requirements above to unlock this badge."}
                </div>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
