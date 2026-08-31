import React, { useState } from 'react';
import { TagSimilarityPair, TaxonomyMigrationLog } from '@/types/taxonomy';
import { executeTaxonomyMigration } from '@/lib/taxonomy/jaccardMerging';
import {
  Tag,
  GitMerge,
  Sparkles,
  CheckCircle2,
  Sliders,
  History,
  AlertTriangle,
  ArrowRight,
  Database,
} from 'lucide-react';

interface TagTaxonomyManagerProps {
  similarityPairs: TagSimilarityPair[];
  migrationLogs: TaxonomyMigrationLog[];
  onExecuteMerge: (log: TaxonomyMigrationLog) => void;
}

export function TagTaxonomyManager({
  similarityPairs,
  migrationLogs,
  onExecuteMerge,
}: TagTaxonomyManagerProps) {
  const [threshold, setThreshold] = useState(0.85);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredPairs = similarityPairs.filter((p) => p.jaccardSimilarity >= threshold);

  const handleMergeAction = (pair: TagSimilarityPair, dryRun: boolean) => {
    setIsProcessing(true);
    setTimeout(() => {
      const log = executeTaxonomyMigration(pair, dryRun);
      onExecuteMerge(log);
      setIsProcessing(false);
    }, 600);
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      {/* Header with Threshold Slider */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
            <GitMerge size={22} className="text-purple-600" /> Automated Tag Synonym & Taxonomy Deduplicator
          </h3>
          <p className="font-mono text-xs text-gray-600">
            Jaccard Similarity analysis • Automatically canonicalize redundant folksonomies across campus events.
          </p>
        </div>

        {/* Threshold Control */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 border-2 border-black rounded font-mono text-xs">
          <Sliders size={16} className="text-gray-500" />
          <span className="font-bold">Similarity Threshold:</span>
          <span className="p-1 bg-lime text-black font-black rounded border border-black">
            {Math.round(threshold * 100)}%
          </span>
          <input
            type="range"
            min="0.60"
            max="0.98"
            step="0.02"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-24 accent-black cursor-pointer"
          />
        </div>
      </div>

      {/* Suggested Tag Merges Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display font-black text-sm text-black flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" /> High-Confidence Synonym Pairs ({filteredPairs.length})
          </h4>
          <span className="font-mono text-[11px] text-gray-500">
            Rule: Merge smaller usage tag into highest-usage canonical tag
          </span>
        </div>

        <div className="overflow-x-auto border-2 border-black rounded-lg">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-black text-gray-700">
                <th className="p-3 font-bold">Redundant Source Tag</th>
                <th className="p-3 font-bold text-center">Action</th>
                <th className="p-3 font-bold">Target Canonical Tag</th>
                <th className="p-3 font-bold text-center">Jaccard Score</th>
                <th className="p-3 font-bold text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPairs.map((pair, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-300 rounded-full font-bold">
                      #{pair.redundantTag.name}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-2">({pair.redundantTag.usageCount} uses)</span>
                  </td>

                  <td className="p-3 text-center text-gray-400">
                    <ArrowRight size={14} className="mx-auto text-black" />
                  </td>

                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-lime/40 text-black border border-black rounded-full font-bold">
                      #{pair.survivingCanonicalTag.name}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-2">({pair.survivingCanonicalTag.usageCount} uses)</span>
                  </td>

                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 bg-black text-lime font-black rounded text-[11px]">
                      {(pair.jaccardSimilarity * 100).toFixed(1)}%
                    </span>
                  </td>

                  <td className="p-3 text-right space-x-2">
                    <button
                      disabled={isProcessing}
                      onClick={() => handleMergeAction(pair, true)}
                      className="px-2.5 py-1 border border-black rounded font-mono text-[10px] font-bold uppercase hover:bg-slate-100 disabled:opacity-40"
                    >
                      Dry Run
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={() => handleMergeAction(pair, false)}
                      className="neu-border bg-lime hover:bg-lime/90 px-3 py-1 font-mono text-[10px] font-black uppercase text-black disabled:opacity-40 shadow-xs active:scale-95"
                    >
                      Merge Tag
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Migration Audit Trail */}
      {migrationLogs.length > 0 && (
        <div className="space-y-3 pt-4 border-t-2 border-slate-200">
          <div className="flex items-center gap-2 font-display font-black text-sm text-black">
            <History size={16} /> Executed Database Taxonomy Migrations
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
            {migrationLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-600">#{log.sourceTagName}</span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className="font-bold text-emerald-700">#{log.targetCanonicalName}</span>
                  <span className="text-gray-400 text-[10px]">
                    ({log.eventsMigratedCount} events & {log.clubsMigratedCount} clubs migrated)
                  </span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    log.status === 'dry_run'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {log.status === 'dry_run' ? 'Dry Run Sim' : 'Migrated ✓'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
