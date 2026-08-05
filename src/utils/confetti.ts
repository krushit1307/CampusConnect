import confetti from "canvas-confetti";

export function triggerConfetti() {
  // OS-level prefers-reduced-motion check
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;

  const defaults = {
    startVelocity: 45,
    spread: 60,
    ticks: 120,
    zIndex: 9999,
    colors: ["#acc412", "#08b3ca", "#d9cdeb", "#e37c2d", "#dff25c"],
    gravity: 1.2,
  };

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = Math.floor(40 * (timeLeft / duration));

    // Left bottom corner
    confetti({
      ...defaults,
      particleCount,
      origin: { x: 0, y: 1 },
      angle: 60,
    });

    // Right bottom corner
    confetti({
      ...defaults,
      particleCount,
      origin: { x: 1, y: 1 },
      angle: 120,
    });
  }, 200);
}
