import { QrCustomizationOptions, MarketingEventDetails } from '@/types/eventMarketing';

/**
 * Draws a print-ready, high-resolution QR marketing flyer to an HTML5 Canvas.
 * Incorporates brand colors, custom patterns, central club logo embedding with protective halo, and event typography.
 */
export function renderMarketingFlyerCanvas(
  canvas: HTMLCanvasElement,
  event: MarketingEventDetails,
  options: QrCustomizationOptions
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Draw Background
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, w, h);

  // 2. Decorative Outer Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // 3. Header Title & Branding
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(event.clubName.toUpperCase(), w / 2, 70);

  ctx.font = 'black 48px "Space Grotesk", sans-serif';
  ctx.fillText(event.title, w / 2, 130);

  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(`${event.dateString} • ${event.location}`, w / 2, 175);

  // 4. Draw QR Code Matrix Simulation (25x25 grid)
  const qrSize = 380;
  const qrX = (w - qrSize) / 2;
  const qrY = 220;
  const moduleCount = 25;
  const moduleSize = qrSize / moduleCount;

  // QR Container Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);

  // Pseudo-random deterministic QR module pattern from targetUrl hash
  const hash = Array.from(event.targetUrl).reduce(
    (acc, char) => (acc * 31 + char.charCodeAt(0)) | 0,
    1337
  );

  ctx.fillStyle = options.primaryColor;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      // Finder patterns (top-left, top-right, bottom-left)
      const isTopLeft = row < 7 && col < 7;
      const isTopRight = row < 7 && col >= moduleCount - 7;
      const isBottomLeft = row >= moduleCount - 7 && col < 7;

      if (isTopLeft || isTopRight || isBottomLeft) {
        const inOuter =
          (row === 0 || row === 6 || col === 0 || col === 6) && isTopLeft ||
          (row === 0 || row === 6 || col === moduleCount - 7 || col === moduleCount - 1) && isTopRight ||
          (row === moduleCount - 7 || row === moduleCount - 1 || col === 0 || col === 6) && isBottomLeft;

        const inInner =
          row >= 2 && row <= 4 && col >= 2 && col <= 4 && isTopLeft ||
          row >= 2 && row <= 4 && col >= moduleCount - 5 && col <= moduleCount - 3 && isTopRight ||
          row >= moduleCount - 5 && row >= moduleCount - 3 && col >= 2 && col <= 4 && isBottomLeft;

        if (inOuter || inInner) {
          ctx.fillRect(qrX + col * moduleSize, qrY + row * moduleSize, moduleSize, moduleSize);
        }
        continue;
      }

      // Center logo cutout zone
      const centerStart = Math.floor(moduleCount / 2) - 2;
      const centerEnd = Math.floor(moduleCount / 2) + 2;
      if (row >= centerStart && row <= centerEnd && col >= centerStart && col <= centerEnd) {
        continue; // Clear for central club logo
      }

      // Deterministic data dots
      const bit = ((hash ^ (row * 37 + col * 53)) & 1) === 1;
      if (bit) {
        if (options.pattern === 'dots') {
          ctx.beginPath();
          ctx.arc(
            qrX + col * moduleSize + moduleSize / 2,
            qrY + row * moduleSize + moduleSize / 2,
            moduleSize * 0.42,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else {
          ctx.fillRect(
            qrX + col * moduleSize,
            qrY + row * moduleSize,
            moduleSize - 0.5,
            moduleSize - 0.5
          );
        }
      }
    }
  }

  // 5. Central Logo Overlay with Protective White Ring
  const logoBoxSize = 75;
  const logoX = qrX + (qrSize - logoBoxSize) / 2;
  const logoY = qrY + (qrSize - logoBoxSize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(logoX - 4, logoY - 4, logoBoxSize + 8, logoBoxSize + 8);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(logoX - 4, logoY - 4, logoBoxSize + 8, logoBoxSize + 8);

  ctx.fillStyle = options.primaryColor;
  ctx.fillRect(logoX, logoY, logoBoxSize, logoBoxSize);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'black 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(event.clubName.charAt(0), logoX + logoBoxSize / 2, logoY + logoBoxSize / 2);

  // 6. Call To Action (Bottom Footer)
  if (options.includeCallToAction) {
    ctx.fillStyle = '#000000';
    ctx.font = 'black 28px "Space Grotesk", sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(options.ctaText.toUpperCase(), w / 2, h - 80);

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('CampusConnect • Verified Event Passport', w / 2, h - 45);
  }
}
