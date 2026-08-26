export interface FloorplanSvgNode {
  id: string; // e.g. "Table_1"
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeType: "table" | "booth" | "stage" | "sponsor_container";
}

export interface SponsorPlacementMapping {
  tableNodeId: string;
  sponsorshipId: string;
  sponsorName: string;
  logoUrl: string;
  targetLinkUrl: string;
}

export interface InjectedSvgNode extends FloorplanSvgNode {
  hasSponsorLogo: boolean;
  sponsorLogoUrl?: string;
  sponsorTargetLink?: string;
  sponsorName?: string;
  svgImageOverlayProps?: {
    href: string;
    x: number;
    y: number;
    width: number;
    height: number;
    onClickUrl: string;
  };
}

/**
 * Merges raw SVG floorplan node definitions with active winning sponsor bids.
 */
export function injectSponsorLogosIntoFloorplan(
  nodes: FloorplanSvgNode[],
  placements: SponsorPlacementMapping[],
): InjectedSvgNode[] {
  const placementMap = new Map<string, SponsorPlacementMapping>();
  for (const p of placements) {
    placementMap.set(p.tableNodeId, p);
  }

  return nodes.map((node) => {
    const activeSponsor = placementMap.get(node.id);

    if (!activeSponsor) {
      return { ...node, hasSponsorLogo: false };
    }

    // Calculate centered padding logo overlay bounds within the SVG node
    const padding = 4;
    const overlayX = node.x + padding;
    const overlayY = node.y + padding;
    const overlayWidth = Math.max(10, node.width - padding * 2);
    const overlayHeight = Math.max(10, node.height - padding * 2);

    return {
      ...node,
      hasSponsorLogo: true,
      sponsorLogoUrl: activeSponsor.logoUrl,
      sponsorTargetLink: activeSponsor.targetLinkUrl,
      sponsorName: activeSponsor.sponsorName,
      svgImageOverlayProps: {
        href: activeSponsor.logoUrl,
        x: overlayX,
        y: overlayY,
        width: overlayWidth,
        height: overlayHeight,
        onClickUrl: activeSponsor.targetLinkUrl,
      },
    };
  });
}

/**
 * Renders an SVG `<image>` tag string representation for raw SVG string injection.
 */
export function generateSvgImageTagString(node: InjectedSvgNode): string {
  if (!node.hasSponsorLogo || !node.svgImageOverlayProps) {
    return "";
  }

  const { href, x, y, width, height, onClickUrl } = node.svgImageOverlayProps;

  return `<g class="sponsor-logo-container" data-node-id="${node.id}" style="cursor: pointer;" onclick="window.open('${onClickUrl}', '_blank')"><image href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" /><title>${node.sponsorName || "Sponsor"}</title></g>`;
}
