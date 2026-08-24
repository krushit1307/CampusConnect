// =============================================================================
// Component: VerificationPage
// Issue: #4048 - Implement 'Automated "Event Series" Certificate Generation'
// Description: Public, unauthenticated page that validates a certificate's 
// cryptographic hash against the database, proving its authenticity to employers.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export const VerificationPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const hash = searchParams.get('hash');

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
    const [certificate, setCertificate] = useState<any>(null);

    useEffect(() => {
        const verify = async () => {
            if (!hash) {
                setStatus('invalid');
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('verified_certificates')
                    .select('series_name, user_name, completion_date, pdf_url')
                    .eq('verification_hash', hash)
                    .single();

                if (error || !data) {
                    setStatus('invalid');
                } else {
                    setCertificate(data);
                    setStatus('valid');
                }
            } catch (err) {
                setStatus('invalid');
            }
        };

        verify();
    }, [hash]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Verifying certificate...</p>
                </div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-red-200 dark:border-red-800">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Invalid Certificate</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        This certificate could not be verified. It may have been altered, revoked, or the link is incorrect.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-green-200 dark:border-green-800">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-black text-green-700 dark:text-green-400 mb-2">Certificate Verified</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    This is a valid, cryptographically verified credential issued by CampusConnect.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 space-y-3 text-left">
                    <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recipient</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{certificate.user_name}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credential</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{certificate.series_name}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Issued</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{new Date(certificate.completion_date).toLocaleDateString()}</p>
                    </div>
                </div>

                <a
                    href={certificate.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-block w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-sm"
                >
                    View Original PDF
                </a>
            </div>
        </div>
    );
};
