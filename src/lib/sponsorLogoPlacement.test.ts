import { describe, it, expect } from "vitest";
import {
  injectSponsorLogosIntoFloorplan,
  generateSvgImageTagString,
  FloorplanSvgNode,
  SponsorPlacementMapping,
} from "./sponsorLogoPlacement";

describe("Develop Dynamic Sponsor Logo Dynamic Placement Suite (#4518)", () => {
  const sampleNodes: FloorplanSvgNode[] = [
    {
      id: "Table_1",
      label: "Main VIP Table",
      x: 100,
      y: 200,
      width: 80,
      height: 40,
      nodeType: "table",
    },
    {
      id: "Table_2",
      label: "Standard Table",
      x: 200,
      y: 200,
      width: 80,
      height: 40,
      nodeType: "table",
    },
  ];

  const samplePlacements: SponsorPlacementMapping[] = [
    {
      tableNodeId: "Table_1",
      sponsorshipId: "spons_acme",
      sponsorName: "Acme Corp",
      logoUrl: "https://storage.campusconnect.edu/logos/acme.svg",
      targetLinkUrl: "https://acme.com/lead-capture",
    },
  ];

  it("injects winning sponsor logo properties into corresponding SVG floorplan node", () => {
    const injected = injectSponsorLogosIntoFloorplan(sampleNodes, samplePlacements);

    const table1 = injected.find((n) => n.id === "Table_1");
    expect(table1?.hasSponsorLogo).toBe(true);
    expect(table1?.sponsorName).toBe("Acme Corp");
    expect(table1?.svgImageOverlayProps?.x).toBe(104); // 100 + 4 padding
    expect(table1?.svgImageOverlayProps?.onClickUrl).toBe("https://acme.com/lead-capture");

    const table2 = injected.find((n) => n.id === "Table_2");
    expect(table2?.hasSponsorLogo).toBe(false);
  });

  it("generates clickable SVG image tag strings for interactive map rendering", () => {
    const injected = injectSponsorLogosIntoFloorplan(sampleNodes, samplePlacements);
    const table1 = injected[0];

    const svgTag = generateSvgImageTagString(table1);

    expect(svgTag).toContain('<g class="sponsor-logo-container"');
    expect(svgTag).toContain('href="https://storage.campusconnect.edu/logos/acme.svg"');
    expect(svgTag).toContain("window.open('https://acme.com/lead-capture', '_blank')");
  });
});
