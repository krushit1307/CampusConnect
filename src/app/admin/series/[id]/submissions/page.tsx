'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { StudentSubmission } from '@/types/github';
import SuspiciousActivityAlert from '@/components/admin/SuspiciousActivityAlert';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminSubmissionsPage() {
  const params = useParams();
  const seriesId = params.id as string;
  
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending_audit' | 'attended'>('pending_audit');

  useEffect(() => {
    async function fetchSubmissions() {
      let query = supabase
        .from('user_series_progress')
        .select(`
          user_id,
          series_id,
          github_repo_url,
          submission_status,
          audit_reason,
          commit_count,
          lines_changed,
          analyzed_at,
          users (full_name, email)
        `)
        .eq('series_id', seriesId);

      if (filter !== 'all') {
        query = query.eq('submission_status', filter);
      }

      const { data, error } = await query;

      if (!error && data) {
        const formatted = data.map(row => ({
          user_id: row.user_id,
          series_id: row.series_id,
          github_repo_url: row.github_repo_url,
          submission_status: row.submission_status,
          audit_reason: row.audit_reason,
          commit_count: row.commit_count,
          lines_changed: row.lines_changed,
          analyzed_at: row.analyzed_at,
          user_name: row.users?.full_name || 'Unknown',
          user_email: row.users?.email || 'Unknown',
        }));
        setSubmissions(formatted);
      }
      setIsLoading(false);
    }
    fetchSubmissions();
  }, [seriesId, filter]);

  const handleApprove = async (userId: string) => {
    const { error } = await supabase
      .from('user_series_progress')
      .update({ submission_status: 'attended', audit_reason: 'Manually approved by admin' })
      .eq('user_id', userId)
      .eq('series_id', seriesId);

    if (!error) {
      setSubmissions(prev => prev.filter(s => s.user_id !== userId));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Series Submissions & Audit Queue
          </h1>
          <div className="flex space-x-2">
            {['all', 'pending_audit', 'attended'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {f.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No submissions match the current filter.</p>
            </div>
          ) : (
            submissions.map((submission) => (
              <div key={submission.user_id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {submission.submission_status === 'pending_audit' && submission.audit_reason ? (
                  <div className="p-6">
                    <SuspiciousActivityAlert
                      studentName={submission.user_name}
                      reason={submission.audit_reason}
                      commitCount={submission.commit_count}
                      linesChanged={submission.lines_changed}
                      onReview={() => window.open(submission.github_repo_url, '_blank')}
                      onApprove={() => handleApprove(submission.user_id)}
                    />
                  </div>
                ) : (
                  <div className="p-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{submission.user_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{submission.user_email}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                      {submission.submission_status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
