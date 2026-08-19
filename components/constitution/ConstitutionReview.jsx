import React from 'react';
import { generateLineDiff } from '@/lib/utils/diff';

export function ConstitutionReview({ proposal, onMerge, onClose }) {
  const diffLines = generateLineDiff(proposal.original_text, proposal.proposed_text);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <span className="inline-block px-3 py-1 bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-xs font-semibold rounded-md">
            Constitution Pull Request
          </span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{proposal.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Proposed by Member ID: {proposal.user_id}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close PR
          </button>
          <button
            onClick={onMerge}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            Merge Proposal
          </button>
        </div>
      </div>

      {/* Visual Diff Viewer */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden font-mono text-xs">
        <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-600 dark:text-gray-400">
          Line-by-Line Changes (Diff View)
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
          {diffLines.map((line, idx) => {
            let bgClass = 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200';
            let prefix = ' ';
            if (line.type === 'added') {
              bgClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300';
              prefix = '+';
            } else if (line.type === 'removed') {
              bgClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300';
              prefix = '-';
            }

            return (
              <div key={idx} className={`px-4 py-1.5 flex items-start gap-3 ${bgClass}`}>
                <span className="select-none font-bold">{prefix}</span>
                <span className="whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
