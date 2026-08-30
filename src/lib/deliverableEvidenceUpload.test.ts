import { describe, it, expect } from "vitest";
import {
  validateEvidenceFile,
  evaluateOrganizerCountersignEligibility,
  attachEvidenceToDeliverable,
  DeliverableEvidenceItem,
} from "./deliverableEvidenceUpload";

describe("Build Interactive Vendor Bidding Deliverable Evidence Upload Suite (#4785)", () => {
  const baseItem: DeliverableEvidenceItem = {
    id: "del_photo_101",
    contractId: "ctr_stage_setup",
    title: "Stage & Sound Setup Complete",
    requiresEvidence: true,
    vendorChecked: false,
    organizerCountersigned: false,
  };

  it("validates allowed MIME types and file size limits", () => {
    expect(validateEvidenceFile("image/jpeg", 2 * 1024 * 1024).isValid).toBe(true);
    expect(validateEvidenceFile("application/pdf", 5 * 1024 * 1024).isValid).toBe(true);

    // Invalid type
    const badType = validateEvidenceFile("video/mp4", 2 * 1024 * 1024);
    expect(badType.isValid).toBe(false);
    expect(badType.error).toContain("Invalid file format");

    // File too large (>10MB)
    const tooLarge = validateEvidenceFile("image/png", 12 * 1024 * 1024);
    expect(tooLarge.isValid).toBe(false);
    expect(tooLarge.error).toContain("File size exceeds the 10 MB limit");
  });

  it("blocks organizer countersign when evidence is missing for evidence-required items", () => {
    // Vendor checked off, but uploaded no evidence photo
    const checkedWithoutEvidence: DeliverableEvidenceItem = {
      ...baseItem,
      vendorChecked: true,
    };

    const result = evaluateOrganizerCountersignEligibility(checkedWithoutEvidence);
    expect(result.canOrganizerCountersign).toBe(false);
    expect(result.blockReason).toContain(
      "Mandatory photographic or document evidence has not been uploaded",
    );
  });

  it("permits organizer countersign once evidence is attached", () => {
    const updatedItem = attachEvidenceToDeliverable(
      baseItem,
      "https://storage.campusconnect.edu/evidence/sound_check.jpg",
      "image/jpeg",
    );

    expect(updatedItem.vendorChecked).toBe(true);
    expect(updatedItem.evidenceFileUrl).toBe(
      "https://storage.campusconnect.edu/evidence/sound_check.jpg",
    );

    const eligibility = evaluateOrganizerCountersignEligibility(updatedItem);
    expect(eligibility.canOrganizerCountersign).toBe(true);
    expect(eligibility.blockReason).toBeUndefined();
  });
});
