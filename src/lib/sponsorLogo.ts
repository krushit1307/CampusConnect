const SPONSOR_GRADIENTS = [
  ["#172554", "#2563eb"],
  ["#4c1d95", "#a855f7"],
  ["#134e4a", "#14b8a6"],
  ["#7c2d12", "#f97316"],
  ["#831843", "#ec4899"],
  ["#365314", "#84cc16"],
  ["#164e63", "#06b6d4"],
  ["#713f12", "#eab308"],
] as const;

function hashName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSponsorLogoGradient(name: string) {
  const [start, end] =
    SPONSOR_GRADIENTS[hashName(name.trim().toLowerCase()) % SPONSOR_GRADIENTS.length];
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
}

export function getSponsorLogoInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
