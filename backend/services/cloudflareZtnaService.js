const axios = require('axios');

/**
 * Synchronizes the Cloudflare Zero Trust network policy rules.
 * Restricts tunnel operations exclusively to academic and platform domains.
 */
async function syncZTNAEdgeRules() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const url = `https://cloudflare.com{accountId}/teams/rules`;

  // Rules target standard protocol isolation, blocking P2P entirely
  const policyPayload = {
    name: 'Enforce Academic-Only Domain Filtering',
    description: 'Block BitTorrent traffic and restrict traffic exclusively to .edu destinations.',
    action: 'allow',
    filters: [
      {
        target: 'network.protocol',
        op: 'in',
        value: ['http', 'https']
      },
      {
        target: 'dns.domain.suffix',
        op: 'in',
        value: ['edu', 'campusconnect.com']
      }
    ],
    // Catch-all implicit drop blocks un-matched protocols like UDP trackers or BitTorrent traffic
    else_action: 'block'
  };

  try {
    const response = await axios.post(url, policyPayload, {
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update Cloudflare Zero Trust egress parameters:', error.response?.data || error.message);
    throw new Error('ZTNA Gateway sync failure.');
  }
}

module.exports = { syncZTNAEdgeRules };
