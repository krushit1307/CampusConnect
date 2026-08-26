export default function init(): Promise<void>;
export function compress_image(
  bytes: Uint8Array,
  width: number,
  height: number,
  quality: number,
): Uint8Array | Promise<Uint8Array>;

