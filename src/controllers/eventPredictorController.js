const { analyzeEventDraft } = require('../services/eventSuccessPredictorService');

async function getDraftAnalysis(req, res) {
  try {
    const draftData = req.body;
    
    if (!draftData || !draftData.category || !draftData.time) {
      return res.status(400).json({ error: 'Missing required event draft parameters.' });
    }

    const analysis = await analyzeEventDraft(draftData);
    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error during event analysis.' });
  }
}

module.exports = { getDraftAnalysis };
