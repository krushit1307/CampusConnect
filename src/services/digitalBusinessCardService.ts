export interface ContactCard {
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  major?: string;
  metAtEventTitle?: string;
}

/**
 * Generates a standard vCard (VCF 3.0) string for export into native address books (iOS / Android / macOS).
 */
export function generateVCardString(contact: ContactCard): string {
  const nameParts = contact.name.trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const firstName = nameParts[0] || "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName};${firstName};;;`,
    `FN:${contact.name.trim()}`,
  ];

  if (contact.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${contact.email.trim()}`);
  }

  if (contact.phone) {
    lines.push(`TEL;TYPE=CELL:${contact.phone.trim()}`);
  }

  if (contact.major) {
    lines.push(`TITLE:${contact.major.trim()} Student`);
  }

  if (contact.linkedinUrl) {
    lines.push(`URL;TYPE=LinkedIn:${contact.linkedinUrl.trim()}`);
  }

  if (contact.metAtEventTitle) {
    lines.push(`NOTE:Met via CampusConnect at event: ${contact.metAtEventTitle}`);
  } else {
    lines.push("NOTE:Connected via CampusConnect Digital Business Card");
  }

  lines.push("END:VCARD");

  return lines.join("\r\n");
}

/**
 * Triggers a native file download for the .vcf contact card.
 */
export function downloadVCard(contact: ContactCard) {
  const vcardText = generateVCardString(contact);
  const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${contact.name.replace(/\s+/g, "_")}_contact.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Encodes business card payload into standard QR code JSON string.
 */
export function encodeBusinessCardPayload(data: {
  userId: string;
  name: string;
  handle?: string;
  eventId?: string;
}): string {
  return JSON.stringify({
    type: "CAMPUSCONNECT_CARD",
    userId: data.userId,
    name: data.name,
    handle: data.handle,
    eventId: data.eventId,
    v: 1,
  });
}

/**
 * Decodes and validates QR code payload.
 */
export function parseBusinessCardPayload(raw: string): {
  userId: string;
  name?: string;
  handle?: string;
  eventId?: string;
} | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "CAMPUSCONNECT_CARD" && parsed.userId) {
      return {
        userId: parsed.userId,
        name: parsed.name,
        handle: parsed.handle,
        eventId: parsed.eventId,
      };
    }
  } catch {
    // If raw payload is simply a UUID or URL with userId
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.trim())) {
      return { userId: raw.trim() };
    }
  }
  return null;
}
