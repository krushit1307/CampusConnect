import React, { useState } from 'react';
import { Shield, Camera, AlertTriangle, CheckCircle, FileSignature } from 'lucide-react';
import { useBiometrics } from '../../hooks/useBiometrics';

interface ConsentModalProps {
    userId: string;
    onClose: () => void;
}

export const BiometricConsentModal: React.FC<ConsentModalProps> = ({ userId, onClose }) => {
    const { submitConsent, loading } = useBiometrics(userId);
    const [step, setStep] = useState(1);
    const [signature, setSignature] = useState('');
    const [agreed, setAgreed] = useState(false);

    // In a real implementation this would hold the captured blob from a webcam
    const [selfieReady, setSelfieReady] = useState(false);

    const handleConsent = async () => {
        if (!agreed || !signature || !selfieReady) return;

        // Mock file
        const mockFile = new File([''], 'selfie.jpg', { type: 'image/jpeg' });
        await submitConsent(signature, mockFile);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">

                <div className="bg-indigo-600 px-6 py-4 flex items-start space-x-3 text-white">
                    <Shield className="w-8 h-8 mt-1 text-indigo-200" />
                    <div>
                        <h2 className="text-xl font-bold">Facial Recognition Consent</h2>
                        <p className="text-indigo-100 text-sm mt-1">Opt-in to automated event photo discovery.</p>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
                                <h4 className="font-bold flex items-center mb-2">
                                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                                    Privacy & Biometric Data Notice
                                </h4>
                                <p className="mb-2">
                                    By opting in, you allow CampusConnect to extract immutable facial geometry endpoints (Biometric Data) from your reference selfie via AWS Rekognition.
                                </p>
                                <p>
                                    This data is used <strong>exclusively</strong> to tag you in event photos uploaded by affiliated organizations. Your biometric vector is never sold, is encrypted at rest, and can be deleted instantly at your request.
                                </p>
                            </div>

                            <label className="flex items-start space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mt-1 flex-shrink-0 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                />
                                <span className="text-sm text-gray-700">
                                    I explicitly consent to the extraction and processing of my biometric data as outlined in the Privacy Policy (GDPR/BIPA compliant).
                                </span>
                            </label>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!agreed}
                                className={`w-full py-3 rounded-xl font-bold text-white transition-colors mt-4 ${agreed ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`}
                            >
                                Continue to Verification
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-32 h-32 bg-gray-100 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center mb-4 relative overflow-hidden group">
                                    {selfieReady ? (
                                        <div className="absolute inset-0 bg-emerald-500/20 flex flex-col items-center justify-center text-emerald-700">
                                            <CheckCircle className="w-8 h-8 mb-1" />
                                            <span className="text-xs font-bold">Captured</span>
                                        </div>
                                    ) : (
                                        <Camera className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 transition-colors cursor-pointer" onClick={() => setSelfieReady(true)} />
                                    )}
                                </div>
                                <h3 className="font-bold text-gray-900">Reference Selfie</h3>
                                <p className="text-sm text-gray-500">Click the camera to capture a clear, well-lit photo of your face.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 flex items-center">
                                    <FileSignature className="w-4 h-4 mr-1.5" />
                                    Digital Signature
                                </label>
                                <input
                                    type="text"
                                    placeholder="Type your full legal name"
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                />
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConsent}
                                    disabled={!selfieReady || signature.length < 3 || loading}
                                    className="flex-1 py-3 px-4 bg-indigo-600 rounded-xl text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        'Submit Authorization'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <span className="text-xs text-gray-500">Secure AES-256 Encryption in Transit</span>
                    <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">Cancel</button>
                </div>
            </div>
        </div>
    );
};
