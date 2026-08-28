import React, { useMemo } from 'react';
import { WatermarkConfig } from '../../types/watermark';
import { Maximize2, Image as ImageIcon } from 'lucide-react';

interface PreviewProps {
    config: WatermarkConfig;
    sampleImageUrl?: string;
}

export const WatermarkPreview: React.FC<PreviewProps> = ({
    config,
    sampleImageUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200'
}) => {

    // Convert configuration properties to CSS for live preview
    const getCornerCoordinates = () => {
        const base = 'absolute flex flex-col items-center justify-center p-4 transition-all duration-300 ease-in-out';

        // Horizontal mapping
        const hMap: Record<string, string> = {
            'left': 'left-0',
            'center': 'left-1/2 -translate-x-1/2',
            'right': 'right-0'
        };

        // Vertical mapping
        const vMap: Record<string, string> = {
            'top': 'top-0',
            'center': 'top-1/2 -translate-y-1/2',
            'bottom': 'bottom-0'
        };

        const [v, h] = config.position.split('-');

        // Edge cases for absolute center
        if (config.position === 'center') {
            return `${base} top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`;
        }

        return `${base} ${vMap[v] || 'bottom-0'} ${hMap[h] || 'right-0'}`;
    };

    const containerStyle = getCornerCoordinates();

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-6">
            <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Maximize2 className="w-5 h-5 text-gray-500" />
                    <h3 className="text-md font-semibold text-gray-900">Live Preview</h3>
                </div>
            </div>

            <div className="p-6 bg-gray-100 flex justify-center items-center">

                {/* The simulated Canvas */}
                <div className="relative overflow-hidden rounded-lg shadow-2xl max-w-full aspect-video bg-gray-900 group">
                    <img
                        src={sampleImageUrl}
                        alt="Sample Event Photography"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />

                    {/* The Watermark Overlay */}
                    {config.isEnabled && (
                        <div
                            className={containerStyle}
                            style={{
                                opacity: config.opacity,
                                width: `${config.scale * 4}%`, // Visual approximation multiplier for web preview vs high-res
                                minWidth: '100px'
                            }}
                        >
                            {(config.watermarkType === 'logo' || config.watermarkType === 'both') && (
                                <div className="mb-2">
                                    {config.logoUrl ? (
                                        <img
                                            src={config.logoUrl}
                                            alt="Brand Logo"
                                            className="w-full h-auto drop-shadow-lg"
                                        />
                                    ) : (
                                        <div className="w-full h-12 bg-white/30 backdrop-blur-sm rounded flex items-center justify-center border border-white/50 border-dashed">
                                            <ImageIcon className="w-6 h-6 text-white" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {(config.watermarkType === 'text' || config.watermarkType === 'both') && (
                                <div
                                    className="whitespace-nowrap font-bold drop-shadow-md text-center"
                                    style={{
                                        color: config.fontColor,
                                        fontFamily: config.fontFamily,
                                        textShadow: '1px 1px 3px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
                                        fontSize: 'min(3vw, 1.5rem)' // Responsive fake font size
                                    }}
                                >
                                    {config.textFormat
                                        .replace('{EventName}', 'Spring Gala')
                                        .replace('{ClubName}', 'Computer Science Society')
                                        .replace('{Date}', new Date().getFullYear().toString())
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-yellow-50 px-6 py-4 flex items-center justify-between border-t border-yellow-100">
                <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> This is a web-based CSS approximation. The edge function executes native binary compositing for pixel-perfect results on high-resolution source files.
                </p>
            </div>
        </div>
    );
};
