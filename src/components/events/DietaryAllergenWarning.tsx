// =============================================================================
// Component: DietaryAllergenWarning
// Issue: #4421 - Dynamic "Dietary Restriction" Allergen Warning
// =============================================================================

interface DietaryAllergenWarningProps {
  message: string;
  acknowledged: boolean;
  onAcknowledgeChange: (acknowledged: boolean) => void;
  disabled?: boolean;
}

export function DietaryAllergenWarning({
  message,
  acknowledged,
  onAcknowledgeChange,
  disabled = false,
}: DietaryAllergenWarningProps) {
  return (
    <div
      role="alert"
      data-testid="dietary-allergen-warning"
      className="animate-pulse border-4 border-red-800 bg-red-600 p-4 text-white shadow-[4px_4px_0_0_#7f1d1d]"
    >
      <p className="font-mono text-sm font-black uppercase leading-relaxed tracking-wide">
        {message}
      </p>
      <label className="mt-3 flex items-start gap-2 font-mono text-xs font-bold uppercase">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={disabled}
          onChange={(e) => onAcknowledgeChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-white"
        />
        I still wish to attend
      </label>
    </div>
  );
}
