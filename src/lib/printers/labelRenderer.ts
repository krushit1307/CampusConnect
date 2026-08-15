// =============================================================================
// Utility: Label Renderer (SVG & ZPL Generation)
// Issue: #3223 - Build a 'Smart Name Badge Printer' Integration
// Description: Generates print - ready payloads for thermal label printers.
// Supports both SVG(for local proxy rendering) and ZPL(Zebra Programming 
// Language) for direct network printer communication.Includes dynamic font
// scaling to prevent long names from running off the sticker edge.
// =============================================================================

export interface BadgeData {
    firstName: string;
    lastName: string;
    major: string;
    clubName?: string;
}

/**
 * Dynamically calculates the optimal font size based on the character count 
 * to ensure the name fits perfectly within a standard 2x3 inch label area.
 */
function calculateFontSize(text: string, maxCharsBase: number, baseFontSize: number): number {
    if (text.length <= maxCharsBase) return baseFontSize;

    // Scale down linearly, but enforce a minimum readable size
    const scale = maxCharsBase / text.length;
    return Math.max(baseFontSize * scale, baseFontSize * 0.5);
}

/**
 * Splits a long name into multiple lines if it exceeds the maximum width.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
    if (text.length <= maxCharsPerLine) return [text];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
        } else {
            currentLine += ' ' + word;
        }
    }
    if (currentLine) lines.push(currentLine.trim());

    return lines;
}

/**
 * Generates an SVG string representing the name badge.
 * This is sent to the local proxy agent which converts it to an image 
 * and pushes it to the printer via CUPS or raw USB.
 */
export function generateBadgeSVG(data: BadgeData): string {
    // Standard 2x3 inch label at 300 DPI = 600x900 pixels
    const width = 600;
    const height = 900;

    const firstNameLines = wrapText(data.firstName.toUpperCase(), 12);
    const lastNameLines = wrapText(data.lastName.toUpperCase(), 12);
    const major = data.major.toUpperCase();

    const firstNameSize = calculateFontSize(data.firstName, 10, 80);
    const lastNameSize = calculateFontSize(data.lastName, 10, 80);

    // Calculate vertical positioning dynamically based on line count
    const totalNameLines = firstNameLines.length + lastNameLines.length;
    const nameBlockHeight = totalNameLines * (firstNameSize * 1.1);
    const startY = (height / 2) - (nameBlockHeight / 2) + 50;

    let svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="white" />
      
      <!-- Header / Event Branding -->
      <rect x="0" y="0" width="${width}" height="150" fill="#4F46E5" />
      <text x="${width / 2}" y="90" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">
        ${data.clubName || 'CAMPUS CONNECT'}
      </text>
      
      <!-- HELLO MY NAME IS equivalent -->
      <text x="${width / 2}" y="220" font-family="Arial, sans-serif" font-size="30" fill="#666" text-anchor="middle" letter-spacing="4">
        ATTENDEE
      </text>
  `;

    // Render First Name
    let currentY = startY;
    firstNameLines.forEach(line => {
        svg += `
      <text x="${width / 2}" y="${currentY}" font-family="Arial, sans-serif" font-size="${firstNameSize}" font-weight="900" fill="#111" text-anchor="middle">
        ${line}
      </text>
    `;
        currentY += firstNameSize * 1.1;
    });

    // Render Last Name
    lastNameLines.forEach(line => {
        svg += `
      <text x="${width / 2}" y="${currentY}" font-family="Arial, sans-serif" font-size="${lastNameSize}" font-weight="900" fill="#111" text-anchor="middle">
        ${line}
      </text>
    `;
        currentY += lastNameSize * 1.1;
    });

    // Render Major / Role
    svg += `
      <rect x="50" y="${height - 200}" width="${width - 100}" height="100" fill="#F3F4F6" rx="10" />
      <text x="${width / 2}" y="${height - 140}" font-family="Arial, sans-serif" font-size="35" font-weight="bold" fill="#4F46E5" text-anchor="middle">
        ${major}
      </text>
    </svg>
  `;

    return svg;
}

/**
 * Generates ZPL (Zebra Programming Language) commands for direct network printing.
 * ZPL is a raw text-based language understood by Zebra thermal printers.
 */
export function generateBadgeZPL(data: BadgeData): string {
    // ^XA starts the format, ^XZ ends it.
    // ^FO = Field Origin (X,Y), ^A = Font, ^FD = Field Data
    const firstNameSize = Math.min(80, Math.floor(800 / data.firstName.length));
    const lastNameSize = Math.min(80, Math.floor(800 / data.lastName.length));

    return `
^XA
^PW600
^LL900
^CI28

^FO0,0^GB600,150,150,B^FS
^FO100,50^A0N,60,60^FD${data.clubName || 'CAMPUS CONNECT'}^FS

^FO150,200^A0N,40,40^FDATTENDEE^FS

^FO50,350^A0N,${firstNameSize},${firstNameSize}^FD${data.firstName.toUpperCase()}^FS
^FO50,450^A0N,${lastNameSize},${lastNameSize}^FD${data.lastName.toUpperCase()}^FS

^FO50,700^GB500,100,5,B^FS
^FO100,730^A0N,50,50^FD${data.major.toUpperCase()}^FS

^XZ
  `.trim();
}
