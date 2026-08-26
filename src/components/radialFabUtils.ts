const RADIAL_DISTANCE = 80;

export function getRadialOffset(angle: number, distance = RADIAL_DISTANCE) {
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.round(Math.cos(radians) * distance),
    y: Math.round(-Math.sin(radians) * distance),
  };
}
