const express = require('express');
const router = express.Router();
const { processVenueSpatialData } = require('../services/densityClusterEngine');

// Secure receiver route parsing locations streamed from enterprise network engines
router.post('/api/telemetry/network/location-update', async (req, res) => {
  const { venueId, locations } = req.body;

  if (!venueId || !Array.isArray(locations)) {
    return res.status(400).json({ error: 'Incomplete coordinate update package payload.' });
  }

  try {
    // Structural layout array normalization: maps incoming AP telemetry packets into raw X/Y coordinate structures
    const standardCoordinates = locations.map(loc => ({
      x: loc.coordinateX || loc.x,
      y: loc.coordinateY || loc.y,
      macHash: loc.hashedMacAddress
    }));

    const assessment = await processVenueSpatialData(venueId, standardCoordinates);

    res.status(200).json({
      status: 'PROCESSED_SUCCESSFULLY',
      threatMitigationActive: assessment.hazardDetected,
      activeThreatsCount: assessment.activeThreatsCount
    });
  } catch (error) {
    console.error('[TELEMETRY OVERFLOW EXCEPTION]', error);
    res.status(500).json({ error: 'Internal failure processing telemetry grid updates.' });
  }
});

module.exports = router;
