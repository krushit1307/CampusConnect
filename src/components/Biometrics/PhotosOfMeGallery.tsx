import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { BiometricConsentModal } from './BiometricConsentModal';
import { Camera, Search, UserCircle, Settings, ShieldOff, Download, Share2 } from 'lucide-react';

export const PhotosOfMeGallery: React.FC<{ userId: string }> = ({ userId }) => {
    const { profile, tags, loading, fetchProfile, fetchMyPhotos, revokeConsent } = useBiometrics(userId);
    const [showModal, setShowModal] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        if (profile?.has_consented) {
            fetchMyPhotos();
        }
    }, [profile?.has_consented, fetchMyPhotos]);

    if (loading && !profile) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!profile?.has_consented) {
        return (
            <div className="max-w-3xl mx-auto p-6 md:p-12">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12 text-center">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <UserCircle className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Find yourself in the crowd.</h2>
                    <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                        Tired of scrolling through hundreds of event photos? Opt-in to our secure facial recognition engine to automatically be notified when you are spotted in a campus gallery.
                    </p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-sm"
                    >
                        Enable "Photos of Me"
                    </button>
                    <p className="text-xs text-gray-400 mt-6 mt-4 flex items-center justify-center">
                        <ShieldOff className="w-3 h-3 mr-1" />
                        We prioritize your privacy. Biometric data is strictly opt-in and revocable at any time.
                    </p>
                </div>

                {showModal && (
                    <BiometricConsentModal userId={userId} onClose={() => {
                        setShowModal(false);
                        fetchProfile();
                    }} />
                )}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center tracking-tight">
                        <Camera className="w-6 h-6 mr-2 text-indigo-600" />
                        Photos of Me
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Our AI engine found you in {tags.length} photos.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by event..."
                            className="text-sm pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to revoke your biometric consent? This will delete your facial reference data immediately.")) {
                                revokeConsent();
                            }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Revoke Consent"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4].map(n => (
                        <div key={n} className="aspect-square bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
            ) : tags.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                    <p className="text-gray-500">You haven't been spotted in any event photos yet.</p>
                </div>
            ) : (
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                    {tags.map((tag) => (
                        <div
                            key={tag.id}
                            className="relative group rounded-xl overflow-hidden cursor-zoom-in break-inside-avoid"
                            onClick={() => setSelectedPhoto(tag.event_photo.storage_url)}
                        >
                            <img
                                src={tag.event_photo.storage_url}
                                alt="Spotted at event"
                                className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                <div className="flex justify-between items-center text-white">
                                    <span className="text-xs font-bold bg-indigo-600 px-2 py-0.5 rounded flex items-center">
                                        <Camera className="w-3 h-3 mr-1" />
                                        {tag.confidence_score.toFixed(1)}% Match
                                    </span>
                                    <div className="flex space-x-2">
                                        <button className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-colors"><Download className="w-4 h-4" /></button>
                                        <button className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-md transition-colors"><Share2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Visual Bounding Box (Debug/VFX purposes) */}
                            <div
                                className="absolute border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] opacity-0 group-hover:opacity-100 transition-opacity rounded-sm"
                                style={{
                                    top: `${tag.bounding_box_json.Top * 100}%`,
                                    left: `${tag.bounding_box_json.Left * 100}%`,
                                    width: `${tag.bounding_box_json.Width * 100}%`,
                                    height: `${tag.bounding_box_json.Height * 100}%`,
                                }}
                            >
                                <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[10px] font-bold px-1 py-0.5 rounded whitespace-nowrap">
                                    Face Match
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
                    <img src={selectedPhoto} alt="Full resolution" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
                        ✕ Close
                    </button>
                </div>
            )}
        </div>
    );
};
