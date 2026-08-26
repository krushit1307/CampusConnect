// =============================================================================
// Component: IconThemeSelector
// Issue: #3345 - Implement 'Dynamic PWA App Icon Switching'
// Description: A visual grid allowing the user to select their preferred
// App Icon theme.Displays a preview of the color and applies the selection
// to the dynamic manifest.
// =============================================================================

import React from 'react';
import { usePWAIcons } from '../../hooks/usePWAIcons';
import { IconTheme } from '../../lib/pwa/manifestGenerator';

export const IconThemeSelector: React.FC = () => {
    const { currentTheme, setTheme, availableThemes, isSupported } = usePWAIcons();

    if (!isSupported) {
        return (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-sm">
                Your browser does not support dynamic PWA icon switching.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">App Icon Theme</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Personalize the app icon and theme color on your device's home screen.
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {availableThemes.map(theme => {
                    const isSelected = currentTheme === theme.id;

                    return (
                        <button
                            key={theme.id}
                            onClick={() => setTheme(theme.id)}
                            className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${isSelected
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md scale-105'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                                }`}
                        >
                            {/* Icon Preview */}
                            <div className={`w-16 h-16 rounded-2xl ${theme.previewClass} shadow-lg flex items-center justify-center mb-3`}>
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>

                            {/* Label */}
                            <span className={`text-xs font-bold text-center ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                {theme.label}
                            </span>

                            {/* Selected Checkmark */}
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-md">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p>
                    <span className="font-bold">Note:</span> After changing the theme, you may need to remove and re-add the app to your home screen for the new icon to appear on iOS and Android.
                </p>
            </div>
        </div>
    );
};
