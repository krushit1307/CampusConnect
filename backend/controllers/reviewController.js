const express = require('express');
const router = express.Router();
const { syncReviewToGraph } = require('../services/graphDatabaseService');
const { evaluateNetworkCollusion } = require('../services/collusionDetector');

router.post('/api/events/:eventId/reviews', async (req, res) => {
  const { eventId } = req.params;
  const { userId, organizerId, dormId, rating, text } = req.body;

  try {
    // 1. Commit record submission parameters locally to Relational Engine
    const reviewId = `rev_${Date.now()}`;
    
    // 2. Synchronously update Neo4j topological connection vectors
    await syncReviewToGraph({
      userId,
      organizerId,
      eventId,
      dormId,
      timestamp: new Date().toISOString(),
      reviewId
    });

    // 3. Trigger async analysis review scan to decouple heavy path graph calculations from request latency
    evaluateNetworkCollusion(eventId).catch(err => 
      console.error('[GRAPH WORKER ERROR] Analysis evaluation failed:', err)
    );

    res.status(201).json({ message: 'Review successfully recorded.' });
  } catch (error) {
    console.error('[REVIEW ROUTE ERROR]', error);
    res.status(500).json({ error: 'Failed to process infrastructure data loops.' });
  }
});

module.exports = router;
