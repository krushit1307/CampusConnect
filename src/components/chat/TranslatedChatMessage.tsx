// =============================================================================
// Component: TranslatedChatMessage
// Issue: #3699 - Implement 'Real-Time "Translation" for Live Chat'
// Description: Renders one chat bubble. Shows the localized text with a subtle
// "Translated from <language>" tooltip and works with the global "View
// Original" toggle. Fully dark/light mode aware.
// =============================================================================

import React from 'react';
import { TranslatedChatMessage as Msg } from '../../lib/chat/translation';
import { languageLabel } from '../../lib/chat/translation';

interface TranslatedChatMessageProps {
    message: Msg;
    displayText: string;
    isTranslated: boolean;
    isOwn?: boolean;
}

export const TranslatedChatMessage: React.FC<TranslatedChatMessageProps> = ({
    message, displayText, isTranslated, isOwn = false,
}) => {
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${isOwn
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                    }`}
            >
                <p className={`text-xs font-bold mb-1 ${isOwn ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {message.sender_name}
                </p>

                {/* Main (localized) text */}
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{displayText}</p>

                {/* Translation badge + tooltip */}
                {isTranslated && (
                    <div className="group relative mt-1.5 inline-flex items-center gap-1">
                        <span className={`text-[10px] font-medium italic ${isOwn ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            ⤵ Translated from {languageLabel(message.source_lang)}
                        </span>
                        {/* Hover tooltip showing the original text */}
                        <div className="pointer-events-none absolute bottom-full left-0 mb-1 hidden group-hover:block w-56 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                            <p className="font-bold mb-1 text-gray-300">Original</p>
                            <p>{message.content}</p>
                            <div className="absolute top-full left-3 -mt-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
