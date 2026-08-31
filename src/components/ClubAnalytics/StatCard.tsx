import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: string;
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "bg-white",
  subtitle,
}: StatCardProps) {
  return (
    <div
      className={`neu-border p-4 flex flex-col gap-2 shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform ${accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600">
          {label}
        </span>
        <div className="p-1.5 neu-border bg-white">
          <Icon size={14} className="text-black" />
        </div>
      </div>
      <div>
        <span className="font-display text-3xl font-black text-black">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <p className="font-mono text-[10px] font-bold uppercase text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
