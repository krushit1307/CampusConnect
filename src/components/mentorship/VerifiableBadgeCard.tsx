import React from 'react';
import { VerifiableSkillBadge } from '@/types/mentorship';
import { Award, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';

interface VerifiableBadgeCardProps {
  badge: VerifiableSkillBadge;
}

export function VerifiableBadgeCard({ badge }: VerifiableBadgeCardProps) {
  return (
    <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-black bg-amber-300 flex items-center justify-center shadow-xs">
          <Award size={22} className="text-black" />
        </div>
        <div>
          <h4 className="font-display font-black text-sm text-black">{badge.title}</h4>
          <div className="font-mono text-[11px] text-gray-500">
            Issued by {badge.issuer} • {badge.category}
          </div>
          <div className="font-mono text-[10px] text-gray-400 mt-0.5">
            Sig: {badge.signatureHash.slice(0, 14)}...
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
          <ShieldCheck size={12} /> Verified
        </span>
        <span className="font-mono text-[10px] font-bold text-amber-600">+{badge.xpValue} XP</span>
      </div>
    </div>
  );
}
