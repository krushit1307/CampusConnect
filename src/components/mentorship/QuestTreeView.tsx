import React from 'react';
import { CampusQuest } from '@/types/mentorship';
import { CheckCircle2, Lock, Zap, Award, Target, ChevronRight } from 'lucide-react';

interface QuestTreeViewProps {
  quests: CampusQuest[];
  onClaimReward?: (questId: string) => void;
}

export function QuestTreeView({ quests, onClaimReward }: QuestTreeViewProps) {
  const tierCategories = {
    1: { title: 'Tier I: Campus Onboarding & Exploration', color: 'border-blue-400' },
    2: { title: 'Tier II: Club Leadership & Workshop Mastery', color: 'border-purple-400' },
    3: { title: 'Tier III: Open-Source & Research Contributions', color: 'border-amber-400' },
    4: { title: 'Tier IV: Senior Capstone & Mentorship Elite', color: 'border-emerald-500' },
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      <div className="border-b-2 border-black pb-4">
        <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
          <Target size={22} className="text-lime-700" /> Campus Quest Tree
        </h3>
        <p className="font-mono text-xs text-gray-600">
          Complete campus quests and peer mentoring milestones to level up your verified student credentials.
        </p>
      </div>

      <div className="space-y-6">
        {[1, 2, 3, 4].map((tierNum) => {
          const tierInfo = tierCategories[tierNum as keyof typeof tierCategories];
          const tierQuests = quests.filter((q) => q.tier === tierNum);

          return (
            <div key={tierNum} className="space-y-3">
              <div className="font-mono text-xs font-black uppercase text-gray-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-black rounded-full" />
                <span>{tierInfo.title}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tierQuests.map((quest) => {
                  const isCompleted = quest.status === 'completed';
                  const isLocked = quest.status === 'locked';
                  const progressPct = Math.round((quest.currentProgress / quest.targetGoal) * 100);

                  return (
                    <div
                      key={quest.id}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-800 shadow-[2px_2px_0px_0px_rgba(6,78,59,1)]'
                          : isLocked
                          ? 'bg-slate-100 border-slate-300 opacity-60'
                          : 'bg-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="font-display font-black text-sm text-black">
                          {quest.title}
                        </h4>
                        {isCompleted ? (
                          <span className="p-1 bg-emerald-100 text-emerald-800 rounded-full">
                            <CheckCircle2 size={16} />
                          </span>
                        ) : isLocked ? (
                          <span className="p-1 text-gray-400">
                            <Lock size={14} />
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-bold text-amber-600 flex items-center gap-0.5">
                            <Zap size={12} fill="currentColor" /> +{quest.rewardXp} XP
                          </span>
                        )}
                      </div>

                      <p className="font-mono text-xs text-gray-600 mb-3 line-clamp-2">
                        {quest.description}
                      </p>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[10px] text-gray-500 font-bold">
                          <span>Progress</span>
                          <span>
                            {quest.currentProgress} / {quest.targetGoal} ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 border border-black rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-lime'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Reward Badge Indicator */}
                      {quest.rewardBadgeName && (
                        <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Award size={12} className="text-amber-500" /> Reward: {quest.rewardBadgeName}
                          </span>
                          {isCompleted && (
                            <span className="text-emerald-700 font-bold">Claimed ✓</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
