import { describe, it, expect } from "vitest";
import {
  calculateSponsorCTR,
  calculateSponsorRoiList,
  compileSwagBagHtmlEmail,
  DigitalSwagItem,
} from "./digitalSwagBag";

describe("Digital Swag Bag Delivery Utility (#3535)", () => {
  const mockItems: DigitalSwagItem[] = [
    {
      id: "swag-1",
      event_id: "evt-1",
      sponsor_name: "Red Bull",
      title: "Free Energy Drink Voucher",
      promo_code: "REDBULL50",
      asset_url: "https://redbull.com/voucher.pdf",
      description: "Show this code for 50% off Red Bull at the canteen",
      click_count: 45,
    },
    {
      id: "swag-2",
      event_id: "evt-1",
      sponsor_name: "GitHub",
      title: "Student Developer Pack",
      promo_code: "GHSTUDENT2026",
      asset_url: "https://education.github.com",
      description: "Unlock free GitHub Copilot and domain names",
      click_count: 90,
    },
  ];

  it("calculates sponsor Click-Through Rate (CTR %)", () => {
    // 45 clicks out of 100 deliveries = 45.0% CTR
    expect(calculateSponsorCTR(100, 45)).toBe(45);
    expect(calculateSponsorCTR(200, 50)).toBe(25);
    expect(calculateSponsorCTR(0, 10)).toBe(0);
  });

  it("aggregates sponsor ROI metrics list", () => {
    const roiList = calculateSponsorRoiList(mockItems, 100);

    expect(roiList).toHaveLength(2);
    expect(roiList[0].sponsorName).toBe("Red Bull");
    expect(roiList[0].totalClicks).toBe(45);
    expect(roiList[0].ctrPercent).toBe(45);

    expect(roiList[1].sponsorName).toBe("GitHub");
    expect(roiList[1].totalClicks).toBe(90);
    expect(roiList[1].ctrPercent).toBe(90);
  });

  it("compiles formatted HTML email for attendee check-in dispatch", () => {
    const html = compileSwagBagHtmlEmail("Annual Hackathon 2026", "Alex Rivera", mockItems);

    expect(html).toContain("Your Digital Swag Bag — Annual Hackathon 2026");
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("REDBULL50");
    expect(html).toContain("https://redbull.com/voucher.pdf");
    expect(html).toContain("GHSTUDENT2026");
  });
});
