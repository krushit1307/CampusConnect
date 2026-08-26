'use client';

import { useState, useEffect } from 'react';
import { AlumniJob } from '@/types/jobs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PublicJobsPage() {
    const [jobs, setJobs] = useState<AlumniJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchActiveJobs() {
            setIsLoading(true);
            // ONLY fetch active jobs that have not expired
            const { data, error } = await supabase
                .from('alumni_jobs')
                .select('*')
                .eq('status', 'active')
                .gte('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (!error && data) {
                setJobs(data);
            }
            setIsLoading(false);
        }
        fetchActiveJobs();
    }, []);

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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                    Alumni Job Board
                </h1>

                {jobs.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            No active job postings available at this time.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                            >
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    {job.title}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-4">
                                    {job.company} • {job.location}
                                </p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                                    {job.description}
                                </p>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Expires: {new Date(job.expires_at).toLocaleDateString()}
                                    </span>
                                    <a
                                        href={job.application_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Apply Now
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
