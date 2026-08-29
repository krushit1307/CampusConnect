'use client';

import { useState, useEffect } from 'react';
import { AlumniJob } from '@/types/jobs';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/auth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AlumniJobsDashboard() {
    const { user } = useAuth();
    const [jobs, setJobs] = useState<AlumniJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        async function fetchJobs() {
            if (!user) return;
            setIsLoading(true);

            let query = supabase
                .from('alumni_jobs')
                .select('*')
                .eq('alumni_id', user.id)
                .order('created_at', { ascending: false });

            if (!showArchived) {
                query = query.eq('status', 'active');
            }

            const { data, error } = await query;

            if (!error && data) {
                setJobs(data);
            }
            setIsLoading(false);
        }
        fetchJobs();
    }, [user, showArchived]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        My Job Postings
                    </h1>
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        {showArchived ? 'Hide Archived' : 'Show Archived'}
                    </button>
                </div>

                {jobs.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            {showArchived ? 'No archived jobs found.' : 'No active job postings. Create one to get started!'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border-l-4 ${job.status === 'archived' ? 'border-gray-400 dark:border-gray-600 opacity-75' :
                                        job.status === 'filled' ? 'border-green-500 dark:border-green-600' :
                                            'border-blue-500 dark:border-blue-600'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                            {job.title}
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                                            {job.company} • {job.location} • {job.job_type}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            job.status === 'archived' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>
                                        {job.status.toUpperCase()}
                                    </span>
                                </div>

                                <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                                    <span>
                                        Expires: {new Date(job.expires_at).toLocaleDateString()}
                                    </span>
                                    {job.status === 'archived' && job.archived_at && (
                                        <span>
                                            Archived: {new Date(job.archived_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {job.status === 'active' && new Date(job.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && (
                                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            ⚠️ This job expires in less than 7 days. Check your email for a renewal link.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
