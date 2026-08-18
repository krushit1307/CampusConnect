// =============================================================================
// Component: PWASettings
// Issue: #3345 - Implement 'Dynamic PWA App Icon Switching'
// Description: The main settings container for PWA customization.Combines 
// the Icon Theme Selector with an "Install App" prompt button for users 
// who haven't yet added the PWA to their home screen.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { IconThemeSelector } from './IconThemeSelector';

// Extend WindowEventMap for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWASettings: React.FC = () => {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already running in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsInstalled(isStandalone);

        // Listen for the install prompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;

        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstalled(true);
            setInstallPrompt(null);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">App Customization</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Personalize your CampusConnect experience.
                </p>
            </div>

            {/* Installation Prompt */}
            {!isInstalled && installPrompt && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold">Install CampusConnect</h3>
                        <p className="text-sm text-indigo-100 mt-1">
                            Add to your home screen for a native app experience and custom icons.
                        </p>
                    </div>
                    <button
                        onClick={handleInstallClick}
                        className="px-6 py-2.5 bg-white text-indigo-600 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors shadow-md whitespace-nowrap"
                    >
                        Install App
                    </button>
                </div>
            )}

            {/* Icon Theme Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <IconThemeSelector />
            </div>
        </div>
    );
};
