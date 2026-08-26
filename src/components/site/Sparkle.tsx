import { Icon } from "@/components/ui/icon";

export function Sparkle({ className = "", size = 24 }: { className?: string; size?: number }) {
  return <Icon name="sparkle" className={className} size={size} />;
}
