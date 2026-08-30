import { parse } from 'node-html-parser';

export const MIN_CONTRAST_RATIO = 7.0; // WCAG AAA
export const MIN_TEXT_LENGTH = 50;

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Convert hex or rgb to RGBColor
function parseColor(color: string): RGBColor | null {
  color = color.trim().toLowerCase();
  if (color.startsWith('#')) {
    let hex = color.substring(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
  }
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  // Simplified for this implementation
  return null;
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(color: RGBColor): number {
  const r = srgbChannelToLinear(color.r);
  const g = srgbChannelToLinear(color.g);
  const b = srgbChannelToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function calculateContrastRatio(colorA: RGBColor, colorB: RGBColor): number {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks an event description (HTML/Markdown) for accessibility issues.
 * Returns an array of error messages.
 */
export function lintEventDescription(description: string): string[] {
  const errors: string[] = [];
  
  if (!description) return errors;

  // Simple Markdown to HTML conversion for basic tags since we might just receive markdown
  // This is a naive conversion enough for our linter to pick up images and text
  let html = description;
  // Convert markdown images to html: ![alt](url) -> <img alt="alt" src="url">
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    return `<img alt="${alt}" src="${src}">`;
  });
  
  const root = parse(html);

  // Rule 1: Reject if there are '<img>' tags without 'alt' attributes
  const images = root.querySelectorAll('img');
  let hasImage = images.length > 0;
  for (const img of images) {
    const alt = img.getAttribute('alt');
    if (alt === undefined || alt === null || alt.trim() === '') {
      errors.push('Image is missing an alt attribute. Please add descriptive text for screen readers.');
    }
  }

  // Rule 2: Reject if text length < 50 characters but contains an image
  const textContent = root.textContent.trim().replace(/\s+/g, ' ');
  if (textContent.length < MIN_TEXT_LENGTH && hasImage) {
    errors.push('Description relies too heavily on images. Please add at least 50 characters of text describing the event.');
  }

  // Rule 3: Reject if 'color' styling fails WCAG AAA contrast ratios
  // Check inline styles for color and background-color
  const styledElements = root.querySelectorAll('[style]');
  for (const el of styledElements) {
    const styleAttr = el.getAttribute('style') || '';
    
    // Parse simple CSS inline styles
    const styles: Record<string, string> = {};
    styleAttr.split(';').forEach(rule => {
      const parts = rule.split(':');
      if (parts.length === 2) {
        styles[parts[0].trim().toLowerCase()] = parts[1].trim();
      }
    });

    const fg = styles['color'];
    const bg = styles['background-color'] || styles['background']; // very simplified

    if (fg && bg) {
      const fgColor = parseColor(fg);
      const bgColor = parseColor(bg);

      if (fgColor && bgColor) {
        const ratio = calculateContrastRatio(fgColor, bgColor);
        if (ratio < MIN_CONTRAST_RATIO) {
          errors.push(`Contrast ratio between text (${fg}) and background (${bg}) is too low (${ratio.toFixed(2)}:1). WCAG AAA requires at least ${MIN_CONTRAST_RATIO}:1.`);
        }
      }
    }
  }

  return errors;
}
