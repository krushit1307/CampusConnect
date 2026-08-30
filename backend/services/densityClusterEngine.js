const CrowdDensitySnapshot = require('../models/CrowdDensitySnapshot');
const axios = require('axios');

// Basic array-based DBSCAN implementation to decouple calculation overhead from outer packages
function runDBSCAN(points, eps, minPts) {
  const labels = new Array(points.length).fill(0); // 0 = unvisited, -1 = noise, >0 = clusterId
  let clusterId = 0;

  function getNeighbors(pIdx) {
    const neighbors = [];
    for (let i = 0; i < points.length; i++) {
      const dist = Math.hypot(points[pIdx].x - points[i].x, points[pIdx].y - points[i].y);
      if (dist <= eps) neighbors.push(i);
    }
    return neighbors;
  }

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== 0) continue;
    const neighbors = getNeighbors(i);
    
    if (neighbors.length < minPts) {
      labels[i] = -1;
    } else {
      clusterId++;
      labels[i] = clusterId;
      let queue = [...neighbors.filter(n => n !== i)];
      
      for (let j = 0; j < queue.length; j++) {
        const qIdx = queue[j];
        if (labels[qIdx] === -1) labels[qIdx] = clusterId;
        if (labels[qIdx] !== 0) continue;
        
        labels[qIdx] = clusterId;
        const qNeighbors = getNeighbors(qIdx);
        if (qNeighbors.length >= minPts) {
          queue.push(...qNeighbors.filter(qn => !queue.includes(qn)));
        }
      }
    }
  }

  // Group indices by matching cluster keys
  const clusters = {};
  for (let i = 0; i < points.length; i++) {
    if (labels[i] > 0) {
      if (!clusters[labels[i]]) clusters[labels[i]] = [];
      clusters[labels[i]].push(points[i]);
    }
  }
  return Object.values(clusters);
}

/**
 * Main evaluation worker loop matching structural network payloads.
 */
async function processVenueSpatialData(venueId, deviceCoordinates) {
  // Configured Parameters: eps = 3 meters tracking accuracy, minPts = 120 devices 
  // representing critical overcrowding configurations
  const epsMeters = 3.0;
  const minDevicesThreshold = 120;

  const pointCloud = deviceCoordinates.map(pt => ({ x: pt.x, y: pt.y }));
  const clusters = runDBSCAN(pointCloud, epsMeters, minDevicesThreshold);
  
  const flaggedHazards = [];
  let triggerRelay = false;

  clusters.forEach(cluster => {
    const totalX = cluster.reduce((sum, p) => sum + p.x, 0);
    const totalY = cluster.reduce((sum, p) => sum + p.y, 0);
    const cX = totalX / cluster.length;
    const cY = totalY / cluster.length;

    // Density calculation across safety bounds
    const estimatedArea = Math.PI * Math.pow(epsMeters, 2); 
    const density = cluster.length / estimatedArea;

    // Critical Breach Constraint: > 4.5 people per square meter indicates a severe crush hazard
    if (density > 4.5) {
      triggerRelay = true;
      flaggedHazards.push({
        centroidX: cX,
        centroidY: cY,
        deviceCountInCluster: cluster.length,
        estimatedDensityPerSqMeter: parseFloat(density.toFixed(2)),
        polygonBounds: cluster.map(p => [p.x, p.y])
      });
    }
  });

  if (triggerRelay) {
    await fireEmergencyAVOverrideRelay(venueId);
  }

  // Persist structured state details to audit storage logs
  await CrowdDensitySnapshot.create({
    venueId,
    totalTrackedDevices: deviceCoordinates.length,
    flaggedHazards,
    relayActionTriggered: triggerRelay
  });

  return { hazardDetected: triggerRelay, activeThreatsCount: flaggedHazards.length };
}

async function fireEmergencyAVOverrideRelay(venueId) {
  try {
    console.error(`[CRUSH HAZARD DETECTED - VENUE: ${venueId}] Executing hardware interlock override!`);
    
    // Dispatches a prioritized network signal directly to the venue's smart POE relay hardware 
    // to instantly cut PA audio paths and engage emergency house lighting arrays.
    await axios.post(`https://campusconnect.infra{venueId}/hardware-relay`, {
      interlockActive: true,
      audioMute: true,
      houseLightsOn: true,
      priorityLevel: "CRITICAL_LIFE_SAFETY"
    }, { timeout: 2000 });
  } catch (err) {
    console.error(`[RELAY CONTROLLER HARDWARE TIMEOUT] Failed to route emergency override to venue: ${venueId}`, err.message);
  }
}

module.exports = { processVenueSpatialData };
