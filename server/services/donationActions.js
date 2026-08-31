// Mock DB interactions for donation badges and thermometers
export const db = {
  clubs: {
    "club_101": { id: "club_101", name: "Blockchain Club", totalRaised: 5000, goal: 20000 }
  },
  donors: {}
};

export const incrementDonationThermometer = (clubId, amount) => {
  if (db.clubs[clubId]) {
    db.clubs[clubId].totalRaised += amount;
    console.log(`[Thermometer] ${db.clubs[clubId].name} total raised is now $${db.clubs[clubId].totalRaised}`);
  }
};

export const awardDonorBadge = (donorIdentifier, badgeName) => {
  if (!db.donors[donorIdentifier]) {
    db.donors[donorIdentifier] = { badges: [] };
  }
  db.donors[donorIdentifier].badges.push(badgeName);
  console.log(`[Badges] Awarded '${badgeName}' badge to donor ${donorIdentifier}`);
};
