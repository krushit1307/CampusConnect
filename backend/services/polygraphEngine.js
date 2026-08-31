const BiometricBaseline = require('../models/BiometricBaseline');

/**
 * Processes calibration frames to extract baseline mathematical boundaries.
 * @param {string} userId - User identifier.
 * @param {string} eventId - Target event context.
 * @param {Array<object>} rawFrames - Sequential telemetry frames from calibration.
 */
async function computeUserBaseline(userId, eventId, rawFrames) {
  if (!rawFrames || rawFrames.length < 10) {
    throw new Error('Insufficient telemetry data to calculate an accurate baseline.');
  }

  const blinkRates = rawFrames.map(f => f.blinkRate);
  const microTwitches = rawFrames.map(f => f.microTwitches);
  const intensities = rawFrames.map(f => f.expressionIntensity);

  const calculateStats = (arr) => {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    return { mean, stdDev: Math.sqrt(variance) || 0.01 }; // Avoid division by zero
  };

  await BiometricBaseline.findOneAndUpdate(
    { userId, eventId },
    {
      metrics: {
        blinkRate: calculateStats(blinkRates),
        microTwitches: calculateStats(microTwitches),
        expressionIntensity: calculateStats(intensities)
      },
      isCalibrated: true
    },
    { upsert: true, new: true }
  );

  return { success: true };
}

/**
 * Evaluates live feedback telemetry against the calculated user baseline.
 * Flags variations shifting beyond 3 standard deviations.
 */
async function verifyFeedbackAuthenticity(userId, eventId, liveData) {
  const baseline = await BiometricBaseline.findOne({ userId, eventId });
  if (!baseline || !baseline.isCalibrated) {
    return { isAuthenticityVerified: true }; // Fallback gracefully if calibration skipped
  }

  let anomalyScore = 0;
  const metricsToVerify = ['blinkRate', 'microTwitches', 'expressionIntensity'];

  metricsToVerify.forEach(metric => {
    const liveVal = liveData[metric];
    const base = baseline.metrics[metric];

    // Calculate how many standard deviations the live data drifts from baseline
    const zScore = Math.abs(liveVal - base.mean) / base.stdDev;
    if (zScore > 3) {
      anomalyScore += 1;
    }
  });

  // If multiple markers shift drastically out of bounds, flag as inauthentic
  return {
    isAuthenticityVerified: anomalyScore < 2,
    score: anomalyScore
  };
}

module.exports = { computeUserBaseline, verifyFeedbackAuthenticity };
