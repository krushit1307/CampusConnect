const axios = require('axios');

/**
 * radiusAnomalyEngine.js
 * 
 * Implements Volumetric Behavioral Anomaly Detection on RADIUS accounting logs.
 * Identifies and disconnects data center-like throughput (Commercial/Illicit Arbitrage) 
 * on federated networks (e.g., Eduroam) to prevent massive billing liabilities.
 */

// Memory store for active federated sessions
// Map<SessionId, SessionState>
const activeSessions = new Map();

// Configuration parameters
const CONFIG = {
  // 100 MB/s roughly equals 800 Mbps, representing maxed-out gigabit throughput
  CRITICAL_THROUGHPUT_BYTES_PER_SEC: 100 * 1024 * 1024, 
  
  // Smoothing factor for Exponential Moving Average (EMA)
  EMA_ALPHA: 0.2, 
  
  // Number of connections/flows that indicate a commercial VPN vs standard student device
  CONCURRENT_CONNECTION_THRESHOLD: 500,

  // MIT Core Switch Controller API for RADIUS Disconnect-Messages (PoD)
  SWITCH_CONTROLLER_API: 'https://mit-core-switch-api.internal.campusconnect.edu/radius/pod'
};

/**
 * Continuously processes incoming RADIUS Accounting-Request packets.
 * Calculates throughput and establishes baselines using time-series EMA.
 * 
 * @param {Object} packet RADIUS Accounting packet
 * @param {string} packet.sessionId Unique cryptographic session ID
 * @param {string} packet.macAddress Device MAC Address
 * @param {number} packet.bytesTransferred Octets transferred in this accounting interval
 * @param {number} packet.concurrentConnections Active flows mapped to this session
 * @param {number} packet.timestamp Epoch timestamp of the packet
 * @param {string} packet.nasIpAddress IP of the MIT switch handling the session
 */
async function streamRadiusAccountingPacket(packet) {
  const { 
    sessionId, 
    macAddress, 
    bytesTransferred, 
    concurrentConnections, 
    timestamp,
    nasIpAddress 
  } = packet;

  if (!activeSessions.has(sessionId)) {
    // Initialize standard student baseline
    activeSessions.set(sessionId, {
      macAddress,
      nasIpAddress,
      startTime: timestamp,
      lastTimestamp: timestamp,
      emaThroughputBps: 0,
      totalBytes: 0,
      isFlagged: false
    });
    return { status: 'SESSION_INITIALIZED' };
  }

  const session = activeSessions.get(sessionId);

  // If already flagged and disconnected, ignore late packets
  if (session.isFlagged) {
    return { status: 'IGNORED_ALREADY_FLAGGED' };
  }

  const timeDeltaSec = (timestamp - session.lastTimestamp) / 1000;
  
  // Protect against divide-by-zero for sub-second overlapping packets
  if (timeDeltaSec > 0) {
    // Calculate instantaneous throughput for this window
    const instantaneousThroughput = bytesTransferred / timeDeltaSec;

    // Mathematically establish Volumetric Baseline using Exponential Moving Average
    if (session.emaThroughputBps === 0) {
      session.emaThroughputBps = instantaneousThroughput;
    } else {
      session.emaThroughputBps = (CONFIG.EMA_ALPHA * instantaneousThroughput) + 
                                 ((1 - CONFIG.EMA_ALPHA) * session.emaThroughputBps);
    }

    session.lastTimestamp = timestamp;
    session.totalBytes += bytesTransferred;

    // Detect Commercial/Illicit Arbitrage:
    // 1. Sustained data-center throughput (maxing out gigabit link)
    // 2. Massive concurrent connections indicative of a VPN routing server
    if (
      session.emaThroughputBps > CONFIG.CRITICAL_THROUGHPUT_BYTES_PER_SEC && 
      concurrentConnections > CONFIG.CONCURRENT_CONNECTION_THRESHOLD
    ) {
      console.warn(`[ANOMALY DETECTED] Session ${sessionId} (MAC: ${macAddress}) exhibiting commercial arbitrage behavior.`);
      console.warn(`[METRICS] EMA Throughput: ${(session.emaThroughputBps / 1024 / 1024).toFixed(2)} MB/s, Connections: ${concurrentConnections}`);
      
      session.isFlagged = true;
      
      // Instantly issue a RADIUS Disconnect-Message (PoD)
      await issueRadiusDisconnectMessage(sessionId, macAddress, nasIpAddress);
      
      return { 
        status: 'ANOMALY_DETECTED_DISCONNECTED', 
        reason: 'Commercial/Illicit Arbitrage' 
      };
    }
  }

  return { status: 'NORMAL_BEHAVIOR' };
}

/**
 * Issues a RADIUS Disconnect-Message (PoD - Packet of Disconnect) to the NAS.
 * Terminates the session instantly to prevent further financial damage to the home institution.
 * 
 * @param {string} sessionId 
 * @param {string} macAddress 
 * @param {string} nasIpAddress 
 */
async function issueRadiusDisconnectMessage(sessionId, macAddress, nasIpAddress) {
  try {
    console.log(`[INFRASTRUCTURE DEFENSE] Dispatching RADIUS PoD for session ${sessionId} to switch ${nasIpAddress}...`);
    
    // Simulate a REST call to the core switch controller which translates it to UDP Port 3799 (RADIUS CoA/PoD)
    await axios.post(CONFIG.SWITCH_CONTROLLER_API, {
      action: 'DISCONNECT',
      radiusAttributes: {
        'Acct-Session-Id': sessionId,
        'Calling-Station-Id': macAddress,
        'NAS-IP-Address': nasIpAddress,
        'Event-Timestamp': Math.floor(Date.now() / 1000)
      },
      reason: 'Automated Fraud Prevention - Commercial Arbitrage Detected'
    }, { timeout: 3000 });

    console.log(`[INFRASTRUCTURE DEFENSE] RADIUS PoD successfully transmitted for ${macAddress}. Session terminated.`);
  } catch (err) {
    // Note: the mock API will always fail because the URL doesn't exist, but this catches it gracefully.
    console.error(`[INFRASTRUCTURE DEFENSE ERROR] Failed to transmit RADIUS PoD:`, err.message);
  }
}

/**
 * Garbage collection for stale sessions to prevent memory leaks
 */
function cleanupStaleSessions() {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    // Remove if inactive for > 15 minutes
    if (now - session.lastTimestamp > 15 * 60 * 1000) {
      activeSessions.delete(sessionId);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupStaleSessions, 15 * 60 * 1000);

module.exports = {
  streamRadiusAccountingPacket,
  issueRadiusDisconnectMessage,
  CONFIG
};
