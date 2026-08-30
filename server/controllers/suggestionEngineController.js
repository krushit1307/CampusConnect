// server/controllers/suggestionEngineController.js

// Mock Database Tables
const db = {
  university_resources: [
    { id: 'Projector_A1', name: 'Projector A1', type: 'Projector' },
    { id: 'Projector_B2', name: 'Projector B2', type: 'Projector' },
    { id: 'Projector_C3', name: 'Projector C3', type: 'Projector' }
  ],
  venues: [
    { id: 'Room_404', name: 'Room 404', has_built_in_av: true },
    { id: 'Room_501', name: 'Room 501', has_built_in_av: true },
    { id: 'Room_202', name: 'Room 202', has_built_in_av: false }
  ],
  resource_bookings: [
    // Projector A1 is booked during this collision window
    { resourceId: 'Projector_A1', start: '2026-09-01T10:00:00Z', end: '2026-09-01T12:00:00Z' }
  ],
  venue_bookings: []
};

export const getAlternativeSuggestions = async (req, res) => {
  try {
    const { requestedResourceId, eventStart, eventEnd } = req.body;
    const startWindow = new Date(eventStart);
    const endWindow = new Date(eventEnd);

    // Helper to evaluate temporal overlaps
    const hasOverlap = (bStart, bEnd) => {
      const bs = new Date(bStart);
      const be = new Date(bEnd);
      return startWindow < be && endWindow > bs;
    };

    // 1. Find all active bookings matching the current temporal window
    const activeResourceBookings = db.resource_bookings.filter(b => hasOverlap(b.start, b.end));
    const activeVenueBookings = db.venue_bookings.filter(b => hasOverlap(b.start, b.end));

    const bookedResourceIds = activeResourceBookings.map(b => b.resourceId);
    const bookedVenueIds = activeVenueBookings.map(b => b.venueId);

    // 2. Query alternative hardware (type: 'Projector' and NOT booked)
    const availableProjectors = db.university_resources.filter(r => 
      r.type === 'Projector' && 
      r.id !== requestedResourceId && 
      !bookedResourceIds.includes(r.id)
    ).map(p => ({ id: p.id, name: p.name, type: 'hardware' }));

    // 3. Query alternative venues (has_built_in_av: true and NOT booked)
    const availableVenues = db.venues.filter(v => 
      v.has_built_in_av === true && 
      !bookedVenueIds.includes(v.id)
    ).map(room => ({ id: room.id, name: room.name, type: 'venue' }));

    // Combine and limit to top 3 recommendations
    const alternativeOptions = [...availableProjectors, ...availableVenues].slice(0, 3);

    return res.status(200).json({
      conflictDetected: true,
      message: `Conflict Detected: ${requestedResourceId} is already booked at this time.`,
      suggestions: alternativeOptions
    });
  } catch (error) {
    return res.status(500).json({ error: "Suggestion engine pipeline fault" });
  }
};
