import React, { useState } from "react";

export interface RatingSliderProps {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export const RatingSlider: React.FC<RatingSliderProps> = ({
  value: externalValue,
  min = 1,
  max = 10,
  onChange,
  className = "",
}) => {
  const [internalValue, setInternalValue] = useState<number>(5);
  const currentValue = externalValue !== undefined ? externalValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (externalValue === undefined) {
      setInternalValue(val);
    }
    if (onChange) {
      onChange(val);
    }
  };

  // Compute percentage offset for positioning the hovering emoji over the thumb
  const percentage = ((currentValue - min) / (max - min)) * 100;

  // Determine expression label & colors based on rating level (1-10)
  const getExpressionData = (val: number) => {
    if (val <= 2) return { label: "Angry", bg: "bg-red-500", mouth: "M 8 18 Q 12 12 16 18" };
    if (val <= 4) return { label: "Sad", bg: "bg-orange-400", mouth: "M 8 17 Q 12 14 16 17" };
    if (val <= 6) return { label: "Neutral", bg: "bg-yellow-400", mouth: "M 8 15 L 16 15" };
    if (val <= 8) return { label: "Happy", bg: "bg-lime-400", mouth: "M 8 13 Q 12 18 16 13" };
    return { label: "Ecstatic", bg: "bg-emerald-400", mouth: "M 7 12 Q 12 20 17 12" };
  };

  const currentExpr = getExpressionData(currentValue);

  return (
    <div className={`relative w-full pt-10 pb-2 ${className}`}>
      {/* Floating Dynamic Emoji Indicator */}
      <div
        className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-all duration-150"
        style={{ left: `${percentage}%` }}
        data-testid="emoji-indicator"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-8 w-8 rounded-full border-2 border-black p-0.5 shadow-sm transition-colors duration-200 ${currentExpr.bg}`}
          aria-hidden="true"
        >
          {/* Eyes */}
          <circle cx="8" cy="9" r="1.5" fill="black" />
          <circle cx="16" cy="9" r="1.5" fill="black" />
          {/* Dynamic Expression Mouth */}
          <path
            d={currentExpr.mouth}
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="mt-0.5 font-mono text-[10px] font-bold text-black uppercase">
          {currentValue} - {currentExpr.label}
        </span>
      </div>

      {/* Range Input Slider */}
      <input
        type="range"
        min={min}
        max={max}
        value={currentValue}
        onChange={handleChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-black dark:bg-gray-700"
        aria-label="Rating slider"
      />
    </div>
  );
};
