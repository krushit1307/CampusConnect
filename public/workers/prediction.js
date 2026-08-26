// Web Worker for client-side event turnout prediction using TensorFlow.js

// Load TensorFlow.js library from CDN
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js");

let modelInstance = null;

async function getOrInitModel() {
  if (modelInstance) return modelInstance;

  // Build a simple sequential model with a single dense layer (Linear Regression)
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 1, inputShape: [3] }));

  // Set trained weights matching our Synthetic Turnout Model:
  // - w1 (normalized RSVP impact) = -0.05 (diminishing return on high volume)
  // - w2 (historical club turnout ratio) = 0.75 (strongest predictor)
  // - w3 (weather condition score) = 0.15 (sunny (+15%) vs rain/storms)
  // - bias = 0.10
  const weights = tf.tensor2d([[-0.05], [0.75], [0.15]], [3, 1]);
  const bias = tf.tensor1d([0.1]);

  model.layers[0].setWeights([weights, bias]);

  modelInstance = model;
  return model;
}

self.onmessage = async (e) => {
  const { rsvpCount, historicalRatio, weatherScore } = e.data;

  try {
    const model = await getOrInitModel();

    // Normalize RSVP count between 0.0 and 1.0 (cap at 100 RSVPs for linear saturation)
    const normalizedRsvp = Math.min(rsvpCount / 100, 1.0);

    // Create 2D tensor representing input features: [rsvp, history, weather]
    const inputTensor = tf.tensor2d([[normalizedRsvp, historicalRatio, weatherScore]], [1, 3]);

    // Execute client-side model inference
    const outputTensor = model.predict(inputTensor);
    const rawPrediction = (await outputTensor.data())[0];

    // Clean up tensors from memory to prevent memory leaks
    inputTensor.dispose();
    outputTensor.dispose();

    // Likely turnout ratio capped between 10% and 100%
    const turnoutRatio = Math.min(1.0, Math.max(0.1, rawPrediction));

    self.postMessage({
      type: "result",
      likelyTurnout: turnoutRatio,
      predictedAttendees: Math.round(rsvpCount * turnoutRatio),
    });
  } catch (error) {
    console.error("[Prediction Worker] Inference failed:", error);
    self.postMessage({
      type: "error",
      error: error.message || String(error),
    });
  }
};
