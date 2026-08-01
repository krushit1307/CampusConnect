export type PasswordStrength = "weak" | "medium" | "strong";

export function getPasswordStrength(value: string): PasswordStrength {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-zA-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^a-zA-Z0-9]/.test(value)) score++;

  if (score <= 1) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const activeSegments = strength === "weak" ? 1 : strength === "medium" ? 2 : 3;
  const colorClass =
    strength === "weak"
      ? "bg-destructive"
      : strength === "medium"
        ? "bg-orange-500"
        : "bg-green-600";
  const label = strength === "weak" ? "Weak" : strength === "medium" ? "Medium" : "Strong";
  const labelColorClass =
    strength === "weak"
      ? "text-destructive"
      : strength === "medium"
        ? "text-orange-600"
        : "text-green-700";

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 border border-black ${i < activeSegments ? colorClass : "bg-transparent"}`}
          />
        ))}
      </div>
      <p className={`mt-1 font-mono text-xs font-bold uppercase ${labelColorClass}`}>{label}</p>
    </div>
  );
}
