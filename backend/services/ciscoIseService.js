const axios = require('axios');

/**
 * Provisions a restricted WPA2-Enterprise session profile inside Cisco ISE.
 * Appends a Zero-Trust group tag to enforce perimeter domain tracking.
 * 
 * @param {string} guestId - The unique tracking entity ID.
 * @param {string} homeCampus - The identity source campus (e.g., 'harvard.edu').
 */
async function provisionZTNASession(guestId, homeCampus) {
  const isIseMock = process.env.CISCO_ISE_MOCK === 'true';
  
  // Enforce rigid group parameters to isolate cross-campus federated actors
  const securityGroupPolicy = 'SGT_FEDERATED_GUEST_ZTNA';
  
  if (isIseMock) {
    return {
      username: `guest-${guestId}`,
      password: Math.random().toString(36).slice(-10),
      policyApplied: securityGroupPolicy,
      tunnelId: 'cf-tunnel-mit-federated-01'
    };
  }

  const url = `https://${process.env.CISCO_ISE_HOST}/ers/config/endpointuser`;
  
  const payload = {
    EndpointUser: {
      name: `guest-${guestId}`,
      description: `Dynamic federated access profile for ${homeCampus}`,
      status: 'ENABLED',
      customAttributes: {
        Security_Group_Policy: securityGroupPolicy,
        Routing_Profile: 'Cloudflare_ZTNA_Tunnel_Route'
      }
    }
  };

  const response = await axios.post(url, payload, {
    auth: {
      username: process.env.CISCO_ISE_REST_USER,
      password: process.env.CISCO_ISE_REST_PASSWORD
    },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  });

  return response.data;
}

module.exports = { provisionZTNASession };
