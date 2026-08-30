/**
 * Campus Bicycle & E-Scooter Share Telemetry Catalog
 */

export const BICYCLE_SHARE_HUB_CATALOG = [
  { hubId: 'HUB-NORTH-LIBRARY', locationName: 'North Library Quad', totalBikes: 25, availableBikes: 18 },
  { hubId: 'HUB-SOUTH-DORM', locationName: 'South Campus Residence Quad', totalBikes: 30, availableBikes: 5 },
  { hubId: 'HUB-ENG-PARK', locationName: 'Engineering Research Center', totalBikes: 20, availableBikes: 14 },
];

/**
 * Validates available bicycle share inventory at campus hub.
 */
export function getAvailableBikesAtHub(hubId: string): number {
  const match = BICYCLE_SHARE_HUB_CATALOG.find(h => h.hubId === hubId);
  return match ? match.availableBikes : 0;
}
