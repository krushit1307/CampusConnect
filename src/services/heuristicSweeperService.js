const db = require('../models');

const TEMP_MAIL_BLACKLIST = ['tempmail.com', 'throwawaymail.com', '10minutemail.com'];

function calculateEntropy(str) {
  const len = str.length;
  const frequencies = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  return Object.values(frequencies).reduce((sum, freq) => {
    const p = freq / len;
    return sum - p * Math.log2(p);
  }, 0);
}

async function sweepFakeAccounts() {
  const users = await db.User.findAll({
    include: [{ model: db.RSVP, as: 'rsvps' }]
  });

  const now = new Date();
  const quarantinedUserIds = [];

  for (const user of users) {
    let flags = 0;

    // Flag 1: Email domain in temp-mail blacklist
    const emailDomain = user.email.split('@')[1];
    if (TEMP_MAIL_BLACKLIST.includes(emailDomain)) {
      flags++;
    }

    // Flag 2: Name contains high entropy (e.g., random string like "ajksdhkj")
    if (calculateEntropy(user.name) > 3.8 && user.name.length > 5) {
      flags++;
    }

    // Flag 3: Account created 3 months ago, 0 RSVPs, 0 profile updates
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    if (user.createdAt < threeMonthsAgo && user.rsvps.length === 0 && !user.profileUpdated) {
      flags++;
    }

    // Flag 4: Velocity attack (Created 1 hour ago, RSVP'd to > 50 events in 5 minutes)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (user.createdAt > oneHourAgo) {
      const recentRsvps = user.rsvps.filter(r => (new Date() - new Date(r.createdAt)) <= 5 * 60 * 1000);
      if (recentRsvps.length > 50) {
        flags++;
      }
    }

    // If account hits > 3 flags, quarantine and drop RSVPs
    if (flags > 3) {
      user.status = 'quarantined';
      await user.save();
      
      // Drop all active RSVPs
      await db.RSVP.destroy({ where: { userId: user.id } });
      quarantinedUserIds.push(user.id);
    }
  }

  return { quarantinedCount: quarantinedUserIds.length, quarantinedUserIds };
}

module.exports = { sweepFakeAccounts };
