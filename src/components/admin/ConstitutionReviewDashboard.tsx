// =============================================================================
// Component: ConstitutionReviewDashboard
// Issue: #3536 - Implement 'Club Constitution Conflict Resolver'
--Description: The Student Union admin portal to review uploaded constitutions.
--Displays a list of documents, their AI - calculated risk scores, and allows
--admins to manually approve or reject documents after reviewing violations.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ConstitutionDocument } from '../../hooks/useConstitutionLinter';
import { ConstitutionDiffViewer } from '../clubs/ConstitutionDiffViewer';

export const ConstitutionReviewDashboard: React.FC = () => {
    const [documents, setDocuments] = useState<ConstitutionDocument[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<ConstitutionDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setIsLoading(true);
        const { data } = await supabase
            .from('constitution_documents')
            .select('*, violations:constitution_violations(*), clubs(name)')
            .order('created_at', { ascending: false });

        setDocuments((data as any[]) || []);
        setIsLoading(false);
    };

    const handleStatusUpdate = async (docId: string, status: 'approved' | 'rejected') => {
        await supabase
            .from('constitution_documents')
            .update({ status, reviewed_at: new Date().toISOString() })
            .eq('id', docId);
        await fetchDocuments();
        if (selectedDoc?.id === docId) {
            setSelectedDoc({ ...selectedDoc, status });
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Document List */}
            <div className="lg:col-span-1 space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white sticky top-0 bg-white dark:bg-gray-900 py-2">
                    Pending Constitutions
                </h2>
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                    </div>
                ) : documents.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No documents to review.</p>
                ) : (
                    documents.map(doc => (
                        <button
                            key={doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedDoc?.id === doc.id
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                    {(doc as any).clubs?.name || 'Unknown Club'}
                                </h3>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${doc.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' :
                                        doc.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                                            doc.status === 'requires_revision' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                                    }`}>
                                    {doc.status.replace('_', ' ').toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>Risk Score:</span>
                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${doc.overall_risk_score > 0.8 ? 'bg-red-500' : doc.overall_risk_score > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                        style={{ width: `${doc.overall_risk_score * 100}%` }}
                                    ></div>
                                </div>
                                <span className="font-bold">{Math.round(doc.overall_risk_score * 100)}%</span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Review Panel */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 min-h-[60vh]">
                {selectedDoc ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {(selectedDoc as any).clubs?.name} Constitution
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Uploaded {new Date(selectedDoc.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleStatusUpdate(selectedDoc.id, 'rejected')}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleStatusUpdate(selectedDoc.id, 'approved')}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold"
                                >
                                    Approve
                                </button>
                            </div>
                        </div>

                        <ConstitutionDiffViewer document={selectedDoc} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        Select a document to review violations.
                    </div>
                )}
            </div>
        </div>
    );
};
