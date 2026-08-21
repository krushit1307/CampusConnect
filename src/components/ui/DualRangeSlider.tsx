import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export interface DualRangeSliderProps {
  /** Minimum slider bound (default: 0) */
  min?: number;
  /** Maximum slider bound (default: 100) */
  max?: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Minimum gap/distance enforced between Min and Max thumbs (default: 0) */
  minStepsBetweenThumbs?: number;
  /** Current range array: [minValue, maxValue] */
  value?: [number, number];
  /** Default range array if uncontrolled: [minValue, maxValue] */
  defaultValue?: [number, number];
  /** Callback fired continuously during thumb dragging */
  onValueChange?: (values: [number, number]) => void;
  /** Callback fired when user releases thumb (ideal for API queries) */
  onValueCommit?: (values: [number, number]) => void;
  /** Custom formatter function for floating labels (e.g. (v) => `$${v}`) */
  formatLabel?: (value: number) => string;
  /** Shows floating value badges above thumbs (default: true) */
  showFloatingLabels?: boolean;
  /** Shows min/max tick labels below track (default: true) */
  showTicks?: boolean;
  /** Custom label for min bound */
  minLabel?: string;
  /** Custom label for max bound */
  maxLabel?: string;
  /** Additional container classes */
  className?: string;
  /** Disables interaction */
  disabled?: boolean;
}

export const DualRangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  DualRangeSliderProps
>(
  (
    {
      min = 0,
      max = 100,
      step = 1,
      minStepsBetweenThumbs = 1,
      value,
      defaultValue = [min, max],
      onValueChange,
      onValueCommit,
      formatLabel = (v) => `$${v}`,
      showFloatingLabels = true,
      showTicks = true,
      minLabel,
      maxLabel,
      className,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    // Internal state for uncontrolled usage or continuous drag rendering
    const [internalValue, setInternalValue] = React.useState<[number, number]>(
      value || defaultValue,
    );

    // Sync state if controlled value prop updates externally
    React.useEffect(() => {
      if (value) {
        setInternalValue(value);
      }
    }, [value]);

    const currentMin = internalValue[0];
    const currentMax = internalValue[1];

    // Calculate percentage positions for track & floating tooltips
    const minPercent = React.useMemo(() => {
      return Math.max(0, Math.min(100, ((currentMin - min) / (max - min)) * 100));
    }, [currentMin, min, max]);

    const maxPercent = React.useMemo(() => {
      return Math.max(0, Math.min(100, ((currentMax - min) / (max - min)) * 100));
    }, [currentMax, min, max]);

    /**
     * Handles value updates with strict collision prevention
     */
    const handleChange = (newValues: number[]) => {
      if (newValues.length < 2) return;

      let [newMin, newMax] = newValues;

      // Enforce minimum step distance collision guard
      const minDistance = minStepsBetweenThumbs * step;
      if (newMax - newMin < minDistance) {
        if (newMin !== currentMin) {
          // Min thumb was moved: Clamp Min thumb so it doesn't cross Max thumb
          newMin = Math.min(newMin, newMax - minDistance);
        } else {
          // Max thumb was moved: Clamp Max thumb so it doesn't drop below Min thumb
          newMax = Math.max(newMax, newMin + minDistance);
        }
      }

      const clampedTuple: [number, number] = [
        Math.max(min, Math.min(newMin, max)),
        Math.max(min, Math.min(newMax, max)),
      ];

      setInternalValue(clampedTuple);
      if (onValueChange) {
        onValueChange(clampedTuple);
      }
    };

    const handleCommit = (newValues: number[]) => {
      if (newValues.length < 2) return;
      const tuple: [number, number] = [newValues[0], newValues[1]];
      if (onValueCommit) {
        onValueCommit(tuple);
      }
    };

    return (
      <div className={cn("relative w-full font-mono py-4 select-none", className)}>
        {/* Floating Tooltip Value Badges */}
        {showFloatingLabels && (
          <div className="relative w-full h-7 mb-1">
            {/* Min Thumb Floating Label */}
            <div
              className="absolute -translate-x-1/2 bottom-0 transition-all duration-75"
              style={{ left: `${minPercent}%` }}
              data-testid="min-thumb-label"
            >
              <span className="px-2 py-0.5 text-[11px] font-extrabold text-white bg-black rounded border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap">
                {formatLabel(currentMin)}
              </span>
            </div>

            {/* Max Thumb Floating Label */}
            <div
              className="absolute -translate-x-1/2 bottom-0 transition-all duration-75"
              style={{ left: `${maxPercent}%` }}
              data-testid="max-thumb-label"
            >
              <span className="px-2 py-0.5 text-[11px] font-extrabold text-white bg-indigo-600 rounded border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap">
                {formatLabel(currentMax)}
              </span>
            </div>
          </div>
        )}

        {/* Radix UI Dual Slider Primitive */}
        <SliderPrimitive.Root
          ref={ref}
          min={min}
          max={max}
          step={step}
          minStepsBetweenThumbs={minStepsBetweenThumbs}
          value={internalValue}
          onValueChange={handleChange}
          onValueCommit={handleCommit}
          disabled={disabled}
          className={cn(
            "relative flex w-full touch-none select-none items-center h-5 cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          {...props}
        >
          {/* Base Background Track */}
          <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-slate-200 border-2 border-black">
            {/* Highlighted Range Track (between Min and Max thumbs) */}
            <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-600" />
          </SliderPrimitive.Track>

          {/* Min Thumb */}
          <SliderPrimitive.Thumb
            aria-label="Minimum value"
            aria-valuenow={currentMin}
            className="block h-6 w-6 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none cursor-grab active:cursor-grabbing"
            data-testid="slider-min-thumb"
          />

          {/* Max Thumb */}
          <SliderPrimitive.Thumb
            aria-label="Maximum value"
            aria-valuenow={currentMax}
            className="block h-6 w-6 rounded-full border-2 border-black bg-indigo-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none cursor-grab active:cursor-grabbing"
            data-testid="slider-max-thumb"
          />
        </SliderPrimitive.Root>

        {/* Min & Max Bounds Ticks Below Track */}
        {showTicks && (
          <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 mt-2">
            <span>{minLabel || formatLabel(min)}</span>
            <span className="text-gray-400">Range: {formatLabel(currentMax - currentMin)}</span>
            <span>{maxLabel || formatLabel(max)}</span>
          </div>
        )}
      </div>
    );
  },
);

DualRangeSlider.displayName = "DualRangeSlider";

export interface PricePreset {
  label: string;
  range: [number, number];
}

export interface PriceFilterPresetGroupProps {
  presets?: PricePreset[];
  activeRange: [number, number];
  onSelectPreset: (range: [number, number]) => void;
  formatLabel?: (v: number) => string;
  className?: string;
}

export const PriceFilterPresetGroup: React.FC<PriceFilterPresetGroupProps> = ({
  presets = [
    { label: "All Prices", range: [0, 100] },
    { label: "Free ($0)", range: [0, 0] },
    { label: "Under $25", range: [0, 25] },
    { label: "$25 – $50", range: [25, 50] },
    { label: "$50+", range: [50, 100] },
  ],
  activeRange,
  onSelectPreset,
  formatLabel = (v) => `$${v}`,
  className,
}) => {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 font-mono text-xs", className)}>
      {presets.map((preset) => {
        const isActive = activeRange[0] === preset.range[0] && activeRange[1] === preset.range[1];
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelectPreset(preset.range)}
            className={cn(
              "px-3 py-1.5 font-bold uppercase rounded-lg border transition-all cursor-pointer",
              isActive
                ? "bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
};
