import { z } from 'zod';

export const SpatialPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const EmergencyExitSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinates: SpatialPointSchema,
  isAccessible: z.boolean().default(true),
});

export const BeaconAnchorSchema = z.object({
  uuid: z.string(),
  major: z.number(),
  minor: z.number(),
  coordinates: SpatialPointSchema,
});

export const VenueCanvasLayoutSchema = z.object({
  venueId: z.string(),
  layoutId: z.string(),
  bounds: z.object({
    width: z.number(),
    length: z.number(),
  }),
  exits: z.array(EmergencyExitSchema),
  beacons: z.array(BeaconAnchorSchema),
  walkableNodes: z.array(
    z.object({
      id: z.string(),
      position: SpatialPointSchema,
      neighbors: z.array(z.string()),
    })
  ),
});

export type SpatialPoint = z.infer<typeof SpatialPointSchema>;
export type EmergencyExit = z.infer<typeof EmergencyExitSchema>;
export type VenueCanvasLayout = z.infer<typeof VenueCanvasLayoutSchema>;
