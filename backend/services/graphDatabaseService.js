const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

/**
 * Structural Ingestion Routine to map Relational nodes and constraints.
 */
async function syncReviewToGraph({ userId, organizerId, eventId, dormId, timestamp, reviewId }) {
  const session = driver.session();
  try {
    const query = `
      MERGE (u:User {id: $userId})
      SET u.dormId = $dormId
      
      MERGE (org:User {id: $organizerId})
      MERGE (e:Event {id: $eventId})
      
      MERGE (u)-[r:REVIEWED_AT_TIME {id: $reviewId}]->(e)
      SET r.timestamp = datetime($timestamp)
      
      // Dynamic structural matching: if users map to identical physical dorm clusters
      WITH u, org, e
      MATCH (roommate:User) 
      WHERE roommate.dormId = u.dormId AND roommate.id <> u.id
      MERGE (u)-[:LIVES_WITH]->(roommate)
    `;
    
    await session.run(query, { userId, organizerId, eventId, dormId, timestamp, reviewId });
  } finally {
    await session.close();
  }
}

module.exports = { driver, syncReviewToGraph };
