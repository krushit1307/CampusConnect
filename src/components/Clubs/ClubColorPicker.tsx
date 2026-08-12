import { useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { getContrastTextColor, isValidHexColor } from "@/lib/clubTheming";

export const CLUB_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "Default (CampusConnect)", value: "" },
  { label: "Black", value: "#000000" },
  { label: "Campus Lime", value: "#6f8000" },
  { label: "Gold", value: "#F1C40F" },
  { label: "Coral", value: "#FF5733" },
  { label: "Sky Blue", value: "#3498DB" },
  { label: "Navy", value: "#123456" },
  { label: "Sage", value: "#DDF25C" },
  { label: "White", value: "#FFFFFF" },
];

interface ClubColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

export function ClubColorPicker({ label, value, onChange, description }: ClubColorPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isValid = value === "" || isValidHexColor(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="font-mono text-sm font-bold uppercase">{label}</label>
        <span
          className={`inline-block h-6 w-6 shrink-0 border-2 border-black ${
            value ? "" : "bg-gradient-to-br from-gray-100 to-gray-300"
          }`}
          style={value ? { backgroundColor: value } : undefined}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-2">
        <HexColorInput
          color={value}
          onChange={onChange}
          prefixed
          placeholder="#RRGGBB"
          aria-label={`${label} hex value`}
          className={`neu-border w-full p-2 font-mono text-sm uppercase ${
            isValid ? "" : "border-red-600"
          }`}
        />
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className="neu-border neu-press shrink-0 bg-black px-3 py-2 font-mono text-xs font-bold uppercase text-white"
        >
          {pickerOpen ? "Close" : "Pick"}
        </button>
      </div>

      {pickerOpen && (
        <div className="flex justify-center">
          <HexColorPicker color={isValid && value ? value : "#000000"} onChange={onChange} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {CLUB_COLOR_PRESETS.map((preset) => {
          const isActive =
            value.toLowerCase() === preset.value.toLowerCase() ||
            (value === "" && preset.value === "");
          return (
            <button
              key={preset.label}
              type="button"
              title={preset.label}
              aria-label={preset.label}
              aria-pressed={isActive}
              onClick={() => onChange(preset.value)}
              className={`h-7 w-7 border-2 transition-transform hover:scale-110 ${
                isActive ? "border-black ring-2 ring-black" : "border-gray-400"
              } ${
                preset.value === "" ? "bg-gradient-to-br from-gray-100 to-gray-300" : "bg-white"
              }`}
              style={preset.value ? { backgroundColor: preset.value } : undefined}
            />
          );
        })}
      </div>

      {value && isValid ? (
        <p
          className="inline-block border-2 border-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
          style={{
            backgroundColor: value,
            color: getContrastTextColor(value),
          }}
        >
          Contrast preview
        </p>
      ) : null}

      {description ? <p className="text-xs font-mono text-gray-600">{description}</p> : null}
    </div>
  );
}
