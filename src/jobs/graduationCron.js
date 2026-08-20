const { processGraduationSwag } = require('../services/swagFulfillmentService');
const db = require('../models');

async function handleGraduationTransition() {
  // Fetch users undergoing transition as part of issue #3613
  const graduatingUsers = await db.User.findAll({ where: { status: 'graduating' } });

  for (const user of graduatingUsers) {
    if (user.clubId) {
      await processGraduationSwag(user, user.clubId);
    }
  }
}

module.exports = { handleGraduationTransition };
