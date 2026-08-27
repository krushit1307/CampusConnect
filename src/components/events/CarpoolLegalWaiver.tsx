// =============================================================================
// Component: CarpoolLegalWaiver
// Issue: #3222 - Develop a 'Carpool Coordination' Module for Off - Campus Events
// Description: Mandatory legal waiver modal that users must digitally sign
// before participating in the carpool module.Protects the university from
// liability regarding student driver accidents.
// =============================================================================

import React, { useState } from 'react';

interface CarpoolLegalWaiverProps {
    onSign: () => Promise<boolean>;
    onClose: () => void;
}

export const CarpoolLegalWaiver: React.FC<CarpoolLegalWaiverProps> = ({ onSign, onClose }) => {
    const [isSigning, setIsSigning] = useState(false);
    const [hasRead, setHasRead] = useState(false);
    const [agrees, setAgrees] = useState(false);

    const handleSign = async () => {
        setIsSigning(true);
        const success = await onSign();
        setIsSigning(false);
        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                    <h2 className="text-2xl font-black text-red-800 dark:text-red-300 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Mandatory Liability Waiver
                    </h2>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        You must read and sign this agreement before using the Carpool Coordination module.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-700 dark:text-gray-300 space-y-4 custom-scrollbar">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Assumption of Risk & Release of Liability</h3>
                    <p>
                        By participating in the CampusConnect Carpool Coordination module, I acknowledge that I am voluntarily arranging transportation with other students. I understand that the University, the Student Union, and the CampusConnect platform administrators are NOT providing transportation services and are NOT responsible for the actions, driving records, or vehicle safety of any student driver.
                    </p>
                    <p>
                        <strong>1. Assumption of Risk:</strong> I understand that riding in a private vehicle operated by another student involves inherent risks, including but not limited to traffic accidents, vehicle breakdowns, and personal injury. I voluntarily assume all such risks.
                    </p>
                    <p>
                        <strong>2. Release of Liability:</strong> I hereby release, waive, and discharge the University, its officers, employees, and the CampusConnect platform from any and all liability, claims, or demands for personal injury, property damage, or wrongful death arising out of my participation in any carpool arrangement facilitated through this platform.
                    </p>
                    <p>
                        <strong>3. Driver Responsibilities:</strong> If I choose to offer rides as a driver, I certify that I possess a valid driver's license, maintain active auto insurance that covers passengers, and that my vehicle is in safe operating condition. I agree to obey all traffic laws and not drive under the influence of alcohol or drugs.
                    </p>
                    <p>
                        <strong>4. Platform Role:</strong> I understand that CampusConnect merely provides a digital bulletin board for students to coordinate rides. The platform does not verify driver's licenses, insurance, or criminal backgrounds of participants.
                    </p>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={hasRead}
                            onChange={(e) => setHasRead(e.target.checked)}
                            className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            I confirm that I have read the entire waiver above and understand its contents.
                        </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agrees}
                            onChange={(e) => setAgrees(e.target.checked)}
                            className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            I agree to the terms and digitally sign this waiver.
                        </span>
                    </label>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSign}
                            disabled={!hasRead || !agrees || isSigning}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                        >
                            {isSigning ? 'Signing...' : 'Digitally Sign Waiver'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
