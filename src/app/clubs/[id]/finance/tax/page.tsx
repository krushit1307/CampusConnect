'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import IRS990NGenerator from '@/components/tax/IRS990NGenerator';
import { ClubTaxProfile } from '@/types/tax';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClubTaxPage() {
    const params = useParams();
    const clubId = params.id as string;

    const [profile, setProfile] = useState<ClubTaxProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            const { data, error } = await supabase
                .from('club_tax_profiles')
                .select('*')
                .eq('club_id', clubId)
                .single();

            if (!error && data) {
                setProfile(data);
            }
            setIsLoading(false);
        }
        fetchProfile();
    }, [clubId]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Tax Compliance & Filing
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your club&apos;s tax-exempt status and generate required IRS filings.
                    </p>
                </div>

                {!profile ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Tax Profile Incomplete
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Please configure your club&apos;s EIN and principal officer information before generating tax forms.
                        </p>
                        <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                            Configure Tax Profile
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Current Tax Profile
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Legal Name:</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{profile.legal_name}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">EIN:</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{profile.ein}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Principal Officer:</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{profile.principal_officer_name}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Contact Email:</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{profile.principal_officer_email}</p>
                                </div>
                            </div>
                        </div>

                        <IRS990NGenerator clubId={clubId} />
                    </>
                )}
            </div>
        </div>
    );
}
