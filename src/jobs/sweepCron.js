const cron = require('node-cron');
const { sweepFakeAccounts } = require('../services/heuristicSweeperService');

// Schedule to run weekly (every Sunday at midnight)
function initSweeperCron() {
  cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly fake account heuristic sweep...');
    try {
      const result = await sweepFakeAccounts();
      console.log(`Sweep completed successfully. Quarantined ${result.quarantinedCount} accounts.`);
    } catch (error) {
      console.error('Error executing fake account heuristic sweep:', error);
    }
  });
}

module.exports = { initSweeperCron };
