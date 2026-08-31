/**
 * backend/services/fdaRecallPipeline.test.js
 *
 * Verification Test Suite for FDA Recall Ingestion, Polygon HalalProvenanceLedger,
 * and Smart Vending MQTT Lockout Pipeline (Issue #5357).
 */

import assert from "assert";
import { FdaRecallPoller, fdaRecallPoller } from "./fdaRecallPoller.js";
import foodSafetyRouter, {
  getActiveRecallsHandler,
  triggerFdaPollHandler,
} from "../controllers/foodSafetyController.js";

async function runTests() {
  console.log("--- Starting FDA Recall & Smart Vending Pipeline Tests ---");

  // Test 1: Instantiation & Default Inventory
  console.log("Test 1: Vending Inventory Configuration");
  const testPoller = new FdaRecallPoller();
  const inventory = testPoller.getInventory();
  assert.strictEqual(inventory.length, 16, "Should have 16 vending coils (A1 - D4)");
  const coilA1 = inventory.find((i) => i.coil === "A1");
  assert.ok(coilA1, "Coil A1 must exist");
  assert.strictEqual(coilA1.lotNumber, "LOT-2026-TURKEY-99");
  assert.strictEqual(coilA1.upcCode, "012345678905");
  console.log("✓ Test 1 Passed: 16 coils loaded with proper lot numbers & UPCs.");

  // Test 2: FDA Enforcement Payload Parsing
  console.log("\nTest 2: FDA Recall Parsing & Entity Extraction");
  const mockFdaRecord = {
    recall_number: "FDA-2026-EC-9901",
    product_description:
      "Turkey & Cheddar Deli Sandwiches. Distributed in campus vending machines. UPC: 012345678905.",
    code_info: "Lot #LOT-2026-TURKEY-99, Expiration Date 2026-09-15",
    reason_for_recall:
      "FDA Safety Alert: E. Coli O157:H7 contamination detected in sliced turkey batch.",
    classification: "Class I",
    status: "Ongoing",
    report_date: "2026-08-31T23:45:00Z",
  };

  const parsed = testPoller.parseRecallDetails(mockFdaRecord);
  assert.strictEqual(parsed.recallId, "FDA-2026-EC-9901");
  assert.strictEqual(parsed.lotNumber, "LOT-2026-TURKEY-99");
  assert.strictEqual(parsed.upcCode, "012345678905");
  assert.ok(parsed.reason.includes("E. Coli"), "Reason must include E. Coli contamination alert");
  console.log("✓ Test 2 Passed: Successfully parsed recall ID, Lot Number, UPC, and reason.");

  // Test 3: Vending Inventory Querying for Affected Coils & Machines
  console.log("\nTest 3: Vending Inventory Querying");
  const queryRes = testPoller.queryVendingInventory("LOT-2026-TURKEY-99", "012345678905");
  assert.deepStrictEqual(
    queryRes.affectedCoils.sort(),
    ["A1", "A2"].sort(),
    "Affected coils must be A1 and A2",
  );
  assert.ok(queryRes.affectedVendingMachines.includes("VM-NORTH-01"));
  assert.ok(queryRes.affectedVendingMachines.includes("VM-SOUTH-04"));
  assert.ok(queryRes.affectedVendingMachines.includes("VM-HUB-12"));
  console.log("✓ Test 3 Passed: Identified affected coils (A1, A2) and vending machines.");

  // Test 4: Blockchain Ledger Anchoring
  console.log("\nTest 4: On-Chain Provenance Ledger Anchoring");
  const ledgerRecord = await testPoller.recordOnLedger(
    "012345678905",
    "LOT-2026-TURKEY-99",
    "E. Coli contamination detected",
  );
  assert.strictEqual(ledgerRecord.lotNumber, "LOT-2026-TURKEY-99");
  assert.strictEqual(ledgerRecord.active, true);
  assert.ok(ledgerRecord.transactionHash.startsWith("0x"), "Transaction hash must start with 0x");
  assert.strictEqual(testPoller.isLotRecalled("LOT-2026-TURKEY-99"), true);
  assert.strictEqual(testPoller.isLotRecalled("LOT-2026-NON-EXISTENT"), false);
  console.log(
    "✓ Test 4 Passed: Ledger record created with active recall status and cryptographic hash.",
  );

  // Test 5: MQTT Hardware Lockout Dispatching
  console.log("\nTest 5: MQTT Hardware Lockout Dispatch");
  let mqttEmitted = false;
  testPoller.once("mqtt_lockout", (packet) => {
    mqttEmitted = true;
    assert.strictEqual(packet.topic, "campusconnect/vending/hardware/lockout");
    assert.strictEqual(packet.payload.event, "FDA_RECALL_LOCKOUT");
    assert.strictEqual(packet.payload.lotNumber, "LOT-2026-TURKEY-99");
    assert.deepStrictEqual(packet.payload.affectedCoils.sort(), ["A1", "A2"].sort());
  });

  const processResult = await testPoller.processRecallMatch(parsed);
  assert.ok(processResult.success, "Recall match processing must succeed");
  assert.ok(mqttEmitted, "MQTT event must be emitted");
  assert.strictEqual(processResult.mqttPayload.event, "FDA_RECALL_LOCKOUT");
  console.log(
    "✓ Test 5 Passed: Dispatched MQTT lockout packet to campusconnect/vending/hardware/lockout.",
  );

  // Test 6: End-to-End FDA Poll Pipeline
  console.log("\nTest 6: End-to-End FDA Recall Poller");
  const pollResult = await testPoller.pollFdaRecalls(mockFdaRecord);
  assert.strictEqual(pollResult.recallsProcessedCount, 1);
  assert.ok(testPoller.getActiveRecalls().length >= 1);
  console.log("✓ Test 6 Passed: End-to-end polling pipeline processed recalls successfully.");

  // Test 7: Controller Handlers
  console.log("\nTest 7: Controller Route Handlers");
  const mockReq = {
    body: { lotNumber: "LOT-2026-TURKEY-99", upcCode: "012345678905", reason: "E. Coli Alert" },
  };
  let responseStatusCode = null;
  let responseJsonData = null;

  const mockRes = {
    status: (code) => {
      responseStatusCode = code;
      return {
        json: (data) => {
          responseJsonData = data;
        },
      };
    },
  };

  await triggerFdaPollHandler(mockReq, mockRes);
  assert.strictEqual(responseStatusCode, 200);
  assert.ok(responseJsonData.pollResult, "Response must include pollResult");

  await getActiveRecallsHandler({}, mockRes);
  assert.strictEqual(responseStatusCode, 200);
  assert.ok(responseJsonData.success);
  assert.ok(Array.isArray(responseJsonData.recalls));
  console.log("✓ Test 7 Passed: Controller endpoints responded with 200 and expected payloads.");

  console.log("\n======================================================");
  console.log("🎉 ALL FDA RECALL & SMART VENDING TESTS PASSED (7/7)");
  console.log("======================================================");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
