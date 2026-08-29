import React, { useState, useEffect } from 'react';
import {
    WatermarkConfig,
    WatermarkPosition,
    WATERMARK_CONSTANTS,
    FontAsset
} from '../../types/watermark';
import {
    Image,
    Type,
    Layers,
    Save,
    ToggleLeft,
    ToggleRight,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Move,
    CheckCircle,
    AlertCircle,
    Info
} from 'lucide-react';
import { useWatermarkGallery } from '../../hooks/useWatermarkGallery'; // We'll create this hook next

interface ConfiguratorProps {
    clubId: string;
    onSaveSuccess?: () => void;
}

export const WatermarkConfigurator: React.FC<ConfiguratorProps> = ({ clubId, onSaveSuccess }) => {
    const {
        config,
        setConfig,
        saveConfig,
        loading,
        error
    } = useWatermarkGallery(clubId);

    const [isDirty, setIsDirty] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Initial load local state setup
    useEffect(() => {
        if (!isDirty && config) {
            setLocalConfig({ ...config });
        }
    }, [config, isDirty]);

    const [localConfig, setLocalConfig] = useState<WatermarkConfig>({
        id: '',
        clubId: clubId,
        isEnabled: false,
        watermarkType: 'both',
        position: WATERMARK_CONSTANTS.DEFAULT_POSITION,
        opacity: WATERMARK_CONSTANTS.DEFAULT_OPACITY,
        scale: WATERMARK_CONSTANTS.DEFAULT_SCALE,
        fontFamily: 'Inter',
        fontColor: '#ffffff',
        textFormat: '{ClubName} | {EventName}',
        minImageWidth: 800,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    const handleUpdate = (updates: Partial<WatermarkConfig>) => {
        setLocalConfig(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setPreviewLoading(true);
        try {
            await saveConfig(localConfig);
            setIsDirty(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setPreviewLoading(false);
        }
    };

    const availableFonts: FontAsset[] = [
        { id: '1', name: 'Inter', weights: [400, 700], url: '', license: 'SIL' },
        { id: '2', name: 'Roboto', weights: [400, 700], url: '', license: 'Apache' },
        { id: '3', name: 'Playfair Display', weights: [400, 700], url: '', license: 'SIL' },
        { id: '4', name: 'Montserrat', weights: [400, 700], url: '', license: 'SIL' }
    ];

    const positionOptions: { value: WatermarkPosition, label: string }[] = [
        { value: 'top-left', label: 'Top Left' },
        { value: 'top-center', label: 'Top Center' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'center-left', label: 'Center Left' },
        { value: 'center', label: 'Absolute Center' },
        { value: 'center-right', label: 'Center Right' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'bottom-center', label: 'Bottom Center' },
        { value: 'bottom-right', label: 'Bottom Right' }
    ];

    if (loading && !localConfig.id) {
        return (
            <div className="flex animate-pulse flex-col space-y-4 p-8 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-64 bg-gray-100 rounded w-full"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-full max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-5 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <div className="bg-gray-800 p-2 rounded-lg border border-gray-600">
                        <Layers className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Watermark Orchestration Engine</h2>
                        <p className="text-xs text-gray-300 mt-1">Configure automated branding for uploaded event photography.</p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => handleUpdate({ isEnabled: !localConfig.isEnabled })}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${localConfig.isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-gray-700 text-gray-400 border border-gray-600'
                            }`}
                    >
                        {localConfig.isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        <span>{localConfig.isEnabled ? 'Active' : 'Disabled'}</span>
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!isDirty || loading || previewLoading}
                        className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${isDirty && !loading
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow shadow-indigo-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed hidden sm:flex'
                            }`}
                    >
                        {previewLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>Save Changes</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-medium text-red-900">Failed to load configuration</h4>
                        <p className="text-xs text-red-700 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {saveSuccess && (
                <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center space-x-2 animate-fade-in">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-900">Configuration saved and deployed to edge processors successfully!</span>
                </div>
            )}

            <div className={`p-6 sm:p-8 space-y-10 ${!localConfig.isEnabled ? 'opacity-50 pointer-events-none grayscale-[0.2] transition-all' : 'transition-all'}`}>

                {/* Section 1: Type Selection */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                        <Type className="w-4 h-4 mr-2 text-indigo-500" /> 1. Composition Type
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SelectionCard
                            active={localConfig.watermarkType === 'logo'}
                            onClick={() => handleUpdate({ watermarkType: 'logo' })}
                            icon={<Image className="w-6 h-6" />}
                            title="Logo Only"
                            description="Use ONLY the primary club logo as the watermark."
                        />
                        <SelectionCard
                            active={localConfig.watermarkType === 'text'}
                            onClick={() => handleUpdate({ watermarkType: 'text' })}
                            icon={<Type className="w-6 h-6" />}
                            title="Text Only"
                            description="Use a dynamic text string (e.g. Event Name)."
                        />
                        <SelectionCard
                            active={localConfig.watermarkType === 'both'}
                            onClick={() => handleUpdate({ watermarkType: 'both' })}
                            icon={<Layers className="w-6 h-6" />}
                            title="Composite (Logo + Text)"
                            description="Stack the logo above dynamic event text."
                        />
                    </div>
                </section>

                {/* Section 2: Logo Configuration (Conditional) */}
                {localConfig.watermarkType !== 'text' && (
                    <section className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                            <Image className="w-4 h-4 mr-2 text-indigo-500" /> 2. Brand Asset
                        </h3>
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-full md:w-1/3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL (Vector or PNG)</label>
                                <input
                                    type="text"
                                    value={localConfig.logoUrl || ''}
                                    onChange={(e) => handleUpdate({ logoUrl: e.target.value })}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                                    placeholder="https://..."
                                />
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> Use transparent PNGs or SVGs.
                                </p>
                            </div>
                            <div className="w-full md:w-2/3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Scale Factor (% of image width)</label>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="range"
                                        min="1" max="25"
                                        value={localConfig.scale}
                                        onChange={(e) => handleUpdate({ scale: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-sm font-bold w-12 text-center text-indigo-700 bg-indigo-50 py-1 rounded border border-indigo-100">{localConfig.scale}%</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Section 3: Text Configuration (Conditional) */}
                {localConfig.watermarkType !== 'logo' && (
                    <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                            <Type className="w-4 h-4 mr-2 text-indigo-500" /> {localConfig.watermarkType === 'both' ? '3.' : '2.'} Typography & Text
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Text Format String</label>
                                <input
                                    type="text"
                                    value={localConfig.textFormat || ''}
                                    onChange={(e) => handleUpdate({ textFormat: e.target.value })}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3 border tracking-wide font-mono bg-gray-50 text-gray-800"
                                    placeholder="{EventName} - {Date}"
                                />
                                <div className="mt-2 flex gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">{"{EventName}"}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">{"{ClubName}"}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">{"{Date}"}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                                    <select
                                        value={localConfig.fontFamily}
                                        onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
                                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2.5 border bg-white"
                                    >
                                        {availableFonts.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
                                    <div className="flex space-x-3 items-center">
                                        <input
                                            type="color"
                                            value={localConfig.fontColor}
                                            onChange={(e) => handleUpdate({ fontColor: e.target.value })}
                                            className="h-10 w-16 p-0.5 border border-gray-300 rounded overflow-hidden cursor-pointer bg-white"
                                        />
                                        <input
                                            type="text"
                                            value={localConfig.fontColor}
                                            onChange={(e) => handleUpdate({ fontColor: e.target.value })}
                                            className="uppercase font-mono flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Section 4: Position and Opacity */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                        <Move className="w-4 h-4 mr-2 text-indigo-500" /> {localConfig.watermarkType === 'both' ? '4.' : '3.'} Positioning & Appearance
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-4">Opacity Matrix</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                                <div className="flex items-center space-x-4 mb-2">
                                    <span className="text-xs font-medium text-gray-500 w-12 text-right">0%</span>
                                    <input
                                        type="range"
                                        min="0.1" max="1" step="0.05"
                                        value={localConfig.opacity}
                                        onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-xs font-medium text-gray-500 w-12">100%</span>
                                </div>
                                <div className="text-center text-xl font-bold text-indigo-600 mt-3 border-t border-gray-200 pt-3">
                                    {Math.round(localConfig.opacity * 100)}%
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-center">Lower opacity helps prevent obscuring important photo details while maintaining branding.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-4">Gravity Anchor</label>
                            <div className="bg-gray-100 p-4 rounded-xl border border-gray-300 aspect-video relative flex">
                                {/* Positioning Grid */}
                                <div className="absolute inset-4 grid grid-cols-3 grid-rows-3 gap-2">
                                    {positionOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleUpdate({ position: opt.value })}
                                            className={`rounded flex items-center justify-center transition-all ${localConfig.position === opt.value
                                                    ? 'bg-indigo-600 text-white shadow-lg scale-105 border-2 border-white'
                                                    : 'bg-white/60 hover:bg-white text-transparent hover:text-gray-400 border border-gray-200 hover:border-indigo-300'
                                                }`}
                                            title={opt.label}
                                        >
                                            <CheckCircle className={`w-5 h-5 ${localConfig.position === opt.value ? 'opacity-100 block' : 'opacity-0 hover:opacity-100'}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

interface SelectionCardProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
}

const SelectionCard: React.FC<SelectionCardProps> = ({ active, onClick, icon, title, description }) => {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col p-5 rounded-xl border-2 text-left transition-all h-full ${active
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-md transform -translate-y-1'
                    : 'border-gray-100 bg-white hover:border-indigo-300 hover:bg-gray-50'
                }`}
        >
            <div className={`p-2 rounded-lg inline-flex mb-3 ${active ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500'}`}>
                {icon}
            </div>
            <h4 className={`text-sm font-bold mb-1 ${active ? 'text-indigo-900' : 'text-gray-900'}`}>{title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </button>
    );
};

// Rotator stub for the icon array above
const RotateCw = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
);
