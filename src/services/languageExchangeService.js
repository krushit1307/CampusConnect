const db = require('../models');

// Helper to check for overlapping free time blocks in availability matrix
function findTimeOverlap(matrixA, matrixB) {
  // matrix format expected: { day: [hours...] } e.g., { "Tuesday": [14, 15] }
  for (const day of Object.keys(matrixA)) {
    if (matrixB[day]) {
      const commonHours = matrixA[day].filter(hour => matrixB[day].includes(hour));
      if (commonHours.length > 0) {
        return { day, hour: commonHours[0] };
      }
    }
  }
  return null;
}

async function findLanguageMatch(userId) {
  const userProfile = await db.LanguageExchangeProfile.findOne({ where: { userId } });
  if (!userProfile) return { matched: false, reason: 'Profile not found.' };

  // Find complementary users (User A native -> User B target, and vice versa)
  const potentialMatches = await db.LanguageExchangeProfile.findAll({
    where: {
      nativeLang: userProfile.targetLang,
      targetLang: userProfile.nativeLang,
    }
  });

  for (const match of potentialMatches) {
    if (match.userId === userProfile.userId) continue;

    const overlap = findTimeOverlap(userProfile.availabilityMatrixJson, match.availabilityMatrixJson);
    if (overlap) {
      return {
        matched: true,
        partnerId: match.userId,
        scheduledTime: overlap
      };
    }
  }

  return { matched: false, reason: 'No matching language partner with overlapping availability found yet.' };
}

module.exports = { findLanguageMatch };
