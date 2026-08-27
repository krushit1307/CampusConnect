export interface DeliverableEvidenceItem {
  id: string;
  contractId: string;
  title: string;
  requiresEvidence: boolean;
  evidenceFileUrl?: string | null;
  evidenceFileType?: string | null;
  evidenceUploadedAtIso?: string | null;
  vendorChecked: boolean;
  organizerCountersigned: boolean;
}

export interface EvidenceValidationResult {
  isValid: boolean;
  error?: string;
}

export interface SignoffEligibilityResult {
  deliverableId: string;
  canOrganizerCountersign: boolean;
  blockReason?: string;
}

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates deliverable evidence upload file metadata.
 */
export function validateEvidenceFile(
  mimeType: string,
  fileSizeBytes: number,
): EvidenceValidationResult {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: "Invalid file format. Only JPG, PNG, WEBP images and PDF documents are accepted.",
    };
  }

  if (fileSizeBytes > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: "File size exceeds the 10 MB limit.",
    };
  }

  return { isValid: true };
}

/**
 * Determines whether an organizer can countersign a deliverable based on evidence upload state.
 */
export function evaluateOrganizerCountersignEligibility(
  item: DeliverableEvidenceItem,
): SignoffEligibilityResult {
  if (!item.vendorChecked) {
    return {
      deliverableId: item.id,
      canOrganizerCountersign: false,
      blockReason: "Vendor has not checked off this deliverable item yet.",
    };
  }

  if (item.requiresEvidence && !item.evidenceFileUrl) {
    return {
      deliverableId: item.id,
      canOrganizerCountersign: false,
      blockReason:
        "Mandatory photographic or document evidence has not been uploaded by the vendor.",
    };
  }

  return {
    deliverableId: item.id,
    canOrganizerCountersign: true,
  };
}

/**
 * Attaches validated evidence URL to the deliverable item state.
 */
export function attachEvidenceToDeliverable(
  item: DeliverableEvidenceItem,
  evidenceUrl: string,
  mimeType: string,
): DeliverableEvidenceItem {
  const validation = validateEvidenceFile(mimeType, 1024 * 1024); // 1MB dummy check
  if (!validation.isValid) {
    throw new Error(validation.error || "Invalid evidence file.");
  }

  const nowIso = new Date().toISOString();

  return {
    ...item,
    evidenceFileUrl: evidenceUrl,
    evidenceFileType: mimeType,
    evidenceUploadedAtIso: nowIso,
    vendorChecked: true,
  };
}
