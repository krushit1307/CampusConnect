// server/services/eventCatchUpMatcher.js

// Mock databases simulating tables across cross-module boundaries
const db = {
  rsvps: [],          // Columns: { userId, eventId, seriesId, attended: boolean }
  users: {},          // Columns: { userId, name, tutoringRating: number, points: number, credits: number }
  tutoringRequests: [], // Columns: { requestId, studentId, eventId, tutorId: null|str, status: 'PENDING'|'ACCEPTED' }
  privateChats: []    // Columns: { chatId, participantIds: [], createdAt: Date }
};

/**
 * Technical Requirement 1 & 2:
 * Evaluates an absence flag, queries attendees, and filters for high-performing tutors.
 */
export const matchCatchUpTutors = async (studentId, eventId, seriesId, eventName = "this session") => {
  try {
    // 1. Fetch users who attended this exact event in the series
    const successfulAttendees = db.rsvps
      .filter(rsvp => rsvp.eventId === eventId && rsvp.seriesId === seriesId && rsvp.attended === true)
      .map(rsvp => rsvp.userId);

    if (successfulAttendees.length === 0) return { matchedCount: 0, message: "No attendees found for this event." };

    // 2. Filter attendees for those who have a Tutoring Rating > 4.5 stars
    const eligibleTutors = successfulAttendees.filter(userId => {
      const user = db.users[userId];
      return user && user.tutoringRating > 4.5;
    });

    if (eligibleTutors.length === 0) return { matchedCount: 0, message: "No high-performing tutors available." };

    const student = db.users[studentId] || { name: "A student" };
    const requestId = `req_${Date.now()}_${studentId}`;

    // 3. Register a pending tutoring match request inside the P2P Tutoring Exchange module
    db.tutoringRequests.push({
      requestId,
      studentId,
      eventId,
      seriesId,
      eligibleTutorIds: eligibleTutors,
      tutorId: null,
      status: 'PENDING'
    });

    // Technical Requirement 3: Automated request message payload dispatched to matching targets
    const requestMessage = `${student.name} missed ${eventName}. Will you spend 30 minutes tutoring them? We will reward you with 500 Gamification Points and 1 Tutoring Credit.`;

    return {
      success: true,
      requestId,
      matchedCount: eligibleTutors.length,
      broadcastMessage: requestMessage,
      targetTutorIds: eligibleTutors
    };
  } catch (error) {
    throw new Error(`Catch-up tutoring matcher failed: ${error.message}`);
  }
};

/**
 * Technical Requirement 4:
 * Handles tutor acceptance, triggers automated chat routing, and flags rewards.
 */
export const acceptTutoringRequest = async (requestId, tutorId) => {
  const request = db.tutoringRequests.find(r => r.requestId === requestId);
  if (!request) throw new Error("Tutoring request not found.");
  if (request.status !== 'PENDING') throw new Error("Request is no longer active.");
  if (!request.eligibleTutorIds.includes(tutorId)) throw new Error("Tutor not eligible for this request.");

  // Update request state
  request.tutorId = tutorId;
  request.status = 'ACCEPTED';

  // Automatically link them in a private chat to schedule the session
  const chatId = `chat_${Date.now()}_${request.studentId}_${tutorId}`;
  db.privateChats.push({
    chatId,
    participantIds: [request.studentId, tutorId],
    createdAt: new Date()
  });

  // Credit rewards on execution completion layout hooks
  const tutor = db.users[tutorId];
  if (tutor) {
    tutor.points += 500;
    tutor.credits += 1;
  }

  return {
    success: true,
    chatId,
    allocatedPoints: 500,
    allocatedCredits: 1
  };
};

export { db };
