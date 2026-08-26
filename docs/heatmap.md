# Dynamic Client-Side Heatmap Overlay

## Overview

This feature introduces a visual heatmap layer for the Campus Map. It enables users to quickly identify dense pockets of activities and events by visualizing event RSVP volumes using a color gradient from blue (low activity) to red (high activity).

## Architecture

We use `leaflet.heat` under the hood, integrated with `react-leaflet`. Since there is no official React wrapper for the heat layer plugin, we instantiated it via a custom `HeatmapLayer` component using `L.heatLayer`.

### Weight Normalization

The heat layer relies on a `weight` parameter between `0.0` and `1.0`.
`rsvp_count` from our events is mapped to this weight using specific thresholds:

- 10 RSVPs: 0.1
- 50 RSVPs: 0.3
- 100 RSVPs: 0.5
- 250 RSVPs: 0.8
- 500+ RSVPs: 1.0 (clamped max)

Interpolation is used for lower numbers.

### Performance Strategy

Rendering thousands of individual `Marker` DOM nodes crashes the browser. `leaflet.heat` renders everything to a single HTML `<canvas>`, making it extremely efficient for massive point clouds.

- A `THRESHOLD = 1000` is defined in `CampusMap.tsx`.
- On initial load, if the fetched events array exceeds 1000 points, the map will automatically default to the **Heatmap View** to preserve UI responsiveness.

## Future Enhancements

- Real-time live attendance data (check-ins) could replace RSVP counts for a truly "live" glow.
- We could introduce a time-slider to predict heatmap density over the coming hours.
