export type IconName =
  | "sparkle"
  | "club-management"
  | "event-planning"
  | "digital-interaction"
  | "star"
  | "check"
  | "minus"
  | "plus";

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  "aria-hidden"?: boolean;
}

export function Icon({
  name,
  className = "",
  size = 24,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <svg className={className} width={size} height={size} aria-hidden={ariaHidden}>
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}
