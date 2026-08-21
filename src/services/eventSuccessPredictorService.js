const axios = require('axios');

async function analyzeEventDraft(eventDraft) {
  try {
    // Send draft parameters (Category, Time, Venue, Budget) to ML microservice or Postgres RPC
    const response = await axios.post(process.env.ML_PREDICTOR_ENDPOINT, {
      category: eventDraft.category,
      time: eventDraft.time,
      venue: eventDraft.venue,
      budget: eventDraft.budget,
      season: eventDraft.season
    }, {
      headers: { Authorization: `Bearer ${process.env.ML_SERVICE_API_KEY}` }
    });

    return {
      success: true,
      score: response.data.score, // e.g., 20 out of 100
      warnings: response.data.warnings, // e.g., ["Outdoor events in December historically have an 80% cancellation rate."]
      suggestions: response.data.suggestions // e.g., "Moving this event to Thursday evening increases predicted attendance by 150%."
    };
  } catch (error) {
    console.error('Failed to evaluate event success predictor:', error);
    throw error;
  }
}

module.exports = { analyzeEventDraft };
