/**
 * Simulation Script: simulate_ticket_concurrency.ts
 *
 * Simulates high-concurrency ticket sales by firing two simultaneous
 * purchase requests to the buy-ticket Edge Function for an event with
 * only 1 available spot left.
 */

const EDGE_FUNCTION_URL = "http://localhost:54321/functions/v1/buy-ticket";

async function simulate() {
  const eventId = "99999999-9999-9999-9999-999999999999"; // Test event UUID
  console.log(`Starting concurrency simulation for event: ${eventId}`);

  // Construct simultaneous POST purchase requests
  const request1 = fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      userId: "11111111-1111-1111-1111-111111111111", // User 1
    }),
  });

  const request2 = fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      userId: "22222222-2222-2222-2222-222222222222", // User 2
    }),
  });

  console.log("Firing two simultaneous purchase requests...");
  const start = Date.now();

  const [res1, res2] = await Promise.all([request1, request2]);
  const duration = Date.now() - start;

  const data1 = await res1.json();
  const data2 = await res2.json();

  console.log(`\nSimulation finished in ${duration}ms.`);
  console.log(`Request 1 (User 1): Status ${res1.status}`, data1);
  console.log(`Request 2 (User 2): Status ${res2.status}`, data2);

  // Assertion checks
  const statuses = [res1.status, res2.status];
  const soldOutCount = [data1.error, data2.error].filter((err) => err === "Sold Out").length;
  const successCount = [data1.success, data2.success].filter((s) => s === true).length;

  console.log("\n--- Verification Report ---");
  console.log(`Success Count (Expected: 1): ${successCount}`);
  console.log(`Sold Out Count (Expected: 1): ${soldOutCount}`);

  if (successCount === 1 && soldOutCount === 1) {
    console.log("SUCCESS: Race condition prevented successfully! Only 1 ticket sold.");
  } else {
    console.error("FAIL: Race condition occurred or request failed to complete.");
  }
}

simulate().catch(console.error);
