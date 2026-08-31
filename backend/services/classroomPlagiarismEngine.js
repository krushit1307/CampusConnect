const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { tokenizeSourceToAST, generateFingerprints, calculateASTSimilarity } = require('./plagiarismDetectionService');
const Gamification = { updateMany: async () => {} };
const PlagiarismReport = require('../models/PlagiarismReport');
const StudentSubmission = { updateMany: async () => {} };

/**
 * Recursively retrieves and concatenates code files inside a cloned repository.
 */
function getRepositorySourceConcatenation(repoPath, extensions = ['.js', '.ts', '.jsx', '.tsx', '.py']) {
  let combinedSource = '';
  const entries = fs.readdirSync(repoPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(repoPath, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      combinedSource += getRepositorySourceConcatenation(fullPath, extensions);
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      combinedSource += `\n/* FILE: ${entry.name} */\n` + fs.readFileSync(fullPath, 'utf8');
    }
  }
  return combinedSource;
}

/**
 * Executes full pairwise AST plagiarism check on an event's submissions.
 */
async function auditEventClassroomSubmissions(eventId, submissions) {
  const tempBaseDir = path.join('/tmp', `plagiarism-audit-${eventId}-${Date.now()}`);
  fs.mkdirSync(tempBaseDir, { recursive: true });

  const repoProfiles = [];

  try {
    // 1. Clone all repositories in parallel
    for (const sub of submissions) {
      const repoDest = path.join(tempBaseDir, sub.userId.toString());
      fs.mkdirSync(repoDest, { recursive: true });
      const git = simpleGit();
      await git.clone(sub.repoUrl, repoDest, ['--depth', '1']);

      const rawSource = getRepositorySourceConcatenation(repoDest);
      const tokens = tokenizeSourceToAST(rawSource);
      const fingerprints = generateFingerprints(tokens, 12);

      repoProfiles.push({
        userId: sub.userId,
        submissionId: sub._id,
        repoUrl: sub.repoUrl,
        rawSource,
        fingerprints
      });
    }

    const flaggedIncidents = [];
    const penalizedUserIds = new Set();

    // 2. Perform Pairwise N-Squared Matrix Comparison
    for (let i = 0; i < repoProfiles.length; i++) {
      for (let j = i + 1; j < repoProfiles.length; j++) {
        const studentA = repoProfiles[i];
        const studentB = repoProfiles[j];

        const similarityScore = calculateASTSimilarity(studentA.fingerprints, studentB.fingerprints);

        if (similarityScore >= 95.0) {
          flaggedIncidents.push({
            eventId,
            studentAId: studentA.userId,
            studentBId: studentB.userId,
            similarityScore: parseFloat(similarityScore.toFixed(2)),
            repoA: studentA.repoUrl,
            repoB: studentB.repoUrl
          });

          penalizedUserIds.add(studentA.userId.toString());
          penalizedUserIds.add(studentB.userId.toString());
        }
      }
    }

    // 3. Automated Penalization: Fail submissions & revoke gamification points
    if (penalizedUserIds.size > 0) {
      const userIdsList = Array.from(penalizedUserIds);

      // Fail submissions
      await StudentSubmission.updateMany(
        { eventId, userId: { $in: userIdsList } },
        { status: 'FAILED_PLAGIARISM', grade: 0 }
      );

      // Revoke points
      await Gamification.updateMany(
        { eventId, userId: { $in: userIdsList } },
        { pointsAwarded: 0, revokedReason: 'ACADEMIC_DISHONESTY_PLAGIARISM_MATCH' }
      );

      // Save full incident report for Organizer inspection
      await PlagiarismReport.insertMany(flaggedIncidents);
    }

    return {
      auditedCount: repoProfiles.length,
      flaggedCount: flaggedIncidents.length,
      penalizedUsersCount: penalizedUserIds.size,
      incidents: flaggedIncidents
    };
  } finally {
    // Clean up temporary volume
    fs.rmSync(tempBaseDir, { recursive: true, force: true });
  }
}

module.exports = { auditEventClassroomSubmissions };
