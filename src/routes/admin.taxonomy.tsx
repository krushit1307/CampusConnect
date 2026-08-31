import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { TagTaxonomyManager } from '@/components/admin/TagTaxonomyManager';
import { TagSimilarityPair, TaxonomyMigrationLog, ClubTag } from '@/types/taxonomy';
import { analyzeTagSynonyms } from '@/lib/taxonomy/jaccardMerging';
import {
  Tag,
  Database,
  GitMerge,
  Sparkles,
  ShieldCheck,
  RotateCw,
  Sliders,
} from 'lucide-react';

export default function AdminTaxonomyPage() {
  const [tagA1] = useState<ClubTag>({ id: 't1', name: 'WebDev', slug: 'webdev', usageCount: 248, category: 'Technical', isCanonical: true });
  const [tagB1] = useState<ClubTag>({ id: 't2', name: 'Frontend', slug: 'frontend', usageCount: 235, category: 'Technical', isCanonical: false });

  const [tagA2] = useState<ClubTag>({ id: 't3', name: 'MachineLearning', slug: 'machinelearning', usageCount: 310, category: 'AI', isCanonical: true });
  const [tagB2] = useState<ClubTag>({ id: 't4', name: 'ML', slug: 'ml', usageCount: 280, category: 'AI', isCanonical: false });

  const [tagA3] = useState<ClubTag>({ id: 't5', name: 'StudyGroup', slug: 'studygroup', usageCount: 190, category: 'Academic', isCanonical: true });
  const [tagB3] = useState<ClubTag>({ id: 't6', name: 'StudySession', slug: 'studysession', usageCount: 175, category: 'Academic', isCanonical: false });

  const [tagPairs] = useState<TagSimilarityPair[]>(
    analyzeTagSynonyms([
      { tagA: tagA1, tagB: tagB1, coOccurrences: 228 }, // Jaccard: 228 / (248 + 235 - 228) = 228 / 255 = 0.894
      { tagA: tagA2, tagB: tagB2, coOccurrences: 275 }, // Jaccard: 275 / (310 + 280 - 275) = 275 / 315 = 0.873
      { tagA: tagA3, tagB: tagB3, coOccurrences: 160 }, // Jaccard: 160 / (190 + 175 - 160) = 160 / 205 = 0.780
    ])
  );

  const [migrationLogs, setMigrationLogs] = useState<TaxonomyMigrationLog[]>([
    {
      id: 'mig-init-1',
      sourceTagName: 'ReactJS',
      targetCanonicalName: 'React',
      eventsMigratedCount: 42,
      clubsMigratedCount: 8,
      similarityScore: 0.94,
      executedAt: '2026-08-28T14:30:00Z',
      status: 'completed',
    },
  ]);

  const handleExecuteMerge = (log: TaxonomyMigrationLog) => {
    setMigrationLogs([log, ...migrationLogs]);
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Database size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Club & Event Taxonomy Management
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Jaccard Similarity analysis & automated canonicalization of redundant event tags.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Taxonomy Health: 96.4% De-duplicated</span>
            </div>
          </div>

          {/* Taxonomy Manager Component */}
          <TagTaxonomyManager
            similarityPairs={tagPairs}
            migrationLogs={migrationLogs}
            onExecuteMerge={handleExecuteMerge}
          />
        </div>
      </div>
    </SiteShell>
  );
}
